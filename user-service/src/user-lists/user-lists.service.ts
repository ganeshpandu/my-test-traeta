import { HttpStatus, Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import {
  LogType,
  MethodNames,
  RESPONSE_STATUS,
  Response,
  ACTIVE_CONDITION,
  REC_SEQ,
  REC_STATUS,
  ADMIN,
  DB_NAME,
  TABLE_NAMES,
  STATUS,
  LIST_ORDER,
  ListNames,
} from '../../constants';
import {
  CreateUserListDto,
  UpdateUserListDto,
  UserListFilterDto,
} from './dto/user-lists.dto';
import { UtilityService } from '../utility/utility.service';

@Injectable()
export class UserListsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) { }

  async create(dto: CreateUserListDto, userId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.CREATED,
      data: '',
    };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'create user list',
      data: {
        service: UserListsService.name,
        method: MethodNames.create,
      },
      input: dto,
    });

    try {
      const created = await this.prismaService.$transaction(async (tx) => {
        // Check for duplicate user list
        const existing = await tx.userLists.findFirst({
          where: {
            userId,
            listId: dto.listId,
            customName: dto.customName,
            ...ACTIVE_CONDITION,
          },
        });

        if (existing) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'user list already exists',
            data: {
              service: UserListsService.name,
              method: MethodNames.create,
            },
            input: dto,
          });
          throw new Error(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
        }

        const userList = await tx.userLists.create({
          data: {
            userId,
            userRecSeq: REC_SEQ.DEFAULT_RECORD,
            listId: dto.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            customName: dto.customName ?? null,
            createdBy: userId,
            ...ACTIVE_CONDITION,
          },
        });

        // Return created record with relations
        return await tx.userLists.findUnique({
          where: {
            userListId_recSeq: {
              userListId: userList.userListId,
              recSeq: REC_SEQ.DEFAULT_RECORD, //userList.recSeq,
            },
          },
        });
      });

      response.data = created;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'create user list successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.create,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create user list failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.create,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status:
          error instanceof Error &&
            error.message === RESPONSE_STATUS.ERROR.ALREADY_EXISTS
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.INTERNAL_SERVER_ERROR,
        data:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async findAll(
    userListFilterDto: UserListFilterDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    const metadata = { pageNumber: 1, limit: 10, totalCount: 0 };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all user lists',
      data: {
        service: UserListsService.name,
        method: MethodNames.findAll,
      },
      input: userListFilterDto,
    });

    try {
      const { pageNumber, limit, search } = userListFilterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;

      const filterConditions = this.utilityService.buildFilter(
        userListFilterDto,
        ['pageNumber', 'limit', 'search', 'timezoneOffsetMinutes', 'timezone'],
      );

      let searchCondition = {};
      if (search && search.trim().length > 0) {
        searchCondition = {
          OR: [
            {
              customName: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        };
      }

      const whereCondition = {
        AND: [filterConditions, searchCondition, ACTIVE_CONDITION],
      };

      const [userLists, totalCount] = await Promise.all([
        this.prismaService.userLists
          .findMany({
            where: { ...whereCondition, userId, list: { ...ACTIVE_CONDITION } },
            skip,
            take: limit,
            select: {
              userListId: true,
              listId: true,
              customName: true,
              list: {
                select: {
                  name: true,
                  // listIcon: true,
                },
              },
              _count: {
                select: {
                  ListItems: {
                    where: {
                      ...ACTIVE_CONDITION,
                    },
                  },
                },
              },
            },
          })
          .then(async (lists) => {
            // Batch compute aggregated counts for Health and Music lists to avoid N+1 queries
            const healthUserListIds = lists
              .filter((l) => l?.list?.name === ListNames.HEALTH)
              .map((l) => l.userListId);

            const musicUserListIds = lists
              .filter((l) => l?.list?.name === ListNames.MUSIC)
              .map((l) => l.userListId);

            const healthCountsMap = new Map<string, number>();
            if (healthUserListIds.length > 0) {
              const healthItems = await this.prismaService.listItems.findMany({
                where: {
                  userListId: { in: healthUserListIds },
                  ...ACTIVE_CONDITION,
                  // include both custom and non-custom; we'll compute counts accordingly
                },
                select: {
                  userListId: true,
                  attributes: true,
                  createdOn: true,
                  isCustom: true,
                  category: { select: { name: true } },
                },
              });

              const formatDate = (d: any) => {
                if (!d) return undefined as unknown as string;
                try {
                  return this.utilityService.formatDate(String(d));
                } catch {
                  return String(d);
                }
              };

              // For each userList: count = aggregated non-custom buckets (category|date) + custom item count
              const perListKeysets = new Map<string, Set<string>>();
              const perListCustomCounts = new Map<string, number>();
              for (const li of healthItems as any[]) {
                const uId = li?.userListId as string;
                if (li?.isCustom) {
                  perListCustomCounts.set(
                    uId,
                    (perListCustomCounts.get(uId) ?? 0) + 1,
                  );
                  continue;
                }
                if (!perListKeysets.has(uId))
                  perListKeysets.set(uId, new Set<string>());
                const keyset = perListKeysets.get(uId);
                const categoryName = li?.category?.name || '';
                const attr = (li?.attributes || {}) as Record<string, any>;
                const rawDate = attr.date || li.date || li.createdOn;
                const date = formatDate(rawDate);
                keyset.add(`${categoryName}|${date}`);
              }

              // Sum both parts into final count per userList
              const allUserListIds = new Set<string>([
                ...Array.from(perListKeysets.keys()),
                ...Array.from(perListCustomCounts.keys()),
              ]);
              for (const uId of allUserListIds) {
                const bucketCount = perListKeysets.get(uId)?.size ?? 0;
                const customCount = perListCustomCounts.get(uId) ?? 0;
                healthCountsMap.set(uId, bucketCount + customCount);
              }
            }

            const musicCountsMap = new Map<string, number>();
            if (musicUserListIds.length > 0) {
              const musicItems = await this.prismaService.listItems.findMany({
                where: {
                  userListId: { in: musicUserListIds },
                  ...ACTIVE_CONDITION,
                },
                select: {
                  userListId: true,
                  attributes: true,
                },
              });

              const perListMusicKeysets = new Map<string, Set<string>>();
              const { timezoneOffsetMinutes } = userListFilterDto;

              for (const mi of musicItems as any[]) {
                const uId = mi?.userListId as string;
                const attr = (mi?.attributes || {}) as Record<string, any>;
                const syncedAt = attr.syncedAt;

                if (syncedAt) {
                  let dateStr: string;
                  if (timezoneOffsetMinutes !== undefined) {
                    // moment.utcOffset() takes minutes.
                    // If client sends 330 for +5:30, moment.utcOffset(330) is correct.
                    dateStr = moment(syncedAt)
                      .utcOffset(timezoneOffsetMinutes)
                      .format('YYYY-MM-DD');
                  } else {
                    dateStr = moment(syncedAt).format('YYYY-MM-DD');
                  }

                  if (!perListMusicKeysets.has(uId)) {
                    perListMusicKeysets.set(uId, new Set<string>());
                  }
                  perListMusicKeysets.get(uId).add(dateStr);
                }
              }

              for (const [uId, keyset] of perListMusicKeysets.entries()) {
                musicCountsMap.set(uId, keyset.size);
              }
            }

            // Process each list item to get signed URLs and sort them
            const processedLists = lists.map((item) => {
              let adjustedCount = (item as any)?._count?.ListItems ?? 0;
              if (item?.list?.name === ListNames.HEALTH) {
                adjustedCount =
                  healthCountsMap.get(item.userListId) ?? adjustedCount;
              } else if (item?.list?.name === ListNames.MUSIC) {
                adjustedCount =
                  musicCountsMap.get(item.userListId) ?? adjustedCount;
              }

              return {
                ...item,
                _count: { ...(item as any)._count, ListItems: adjustedCount },
                list: {
                  predefinedList: item.list.name,
                  // Add order for sorting
                  order: LIST_ORDER[item.list.name] || 99, // Default to high number for custom lists
                },
              };
            });

            // Sort the lists based on the predefined order
            return processedLists.sort((a, b) => a.list.order - b.list.order);
          })
          .then((lists) =>
            lists.map(({ list: { order, ...list }, ...rest }) => ({
              ...rest,
              list,
            })),
          ), // Remove the order property after sorting
        this.prismaService.userLists.count({
          where: { ...whereCondition, userId },
        }),
      ]);

      Object.assign(metadata, { pageNumber, limit, totalCount });
      response.data = { data: userLists, metadata };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all user lists successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all user lists failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.findAll,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async findUnique(userListId: string, userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique user list',
      data: {
        service: UserListsService.name,
        method: MethodNames.findUnique,
      },
      input: userListId,
    });

    try {
      const result = await this.prismaService.userLists.findUnique({
        where: {
          userListId_recSeq: {
            userListId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          userId,
        },
      });

      response.data = result;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique user list successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique user list failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.findUnique,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async update(
    userListId: string,
    update: UpdateUserListDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'update user list',
      data: {
        service: UserListsService.name,
        method: MethodNames.update,
      },
      input: { userListId, update },
    });

    try {
      const existing = await this.prismaService.userLists.findUnique({
        where: {
          userListId_recSeq: {
            userListId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          userId,
        },
      });

      if (!existing) {
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      if (update.customName && update.customName.trim()) {
        const check = await this.prismaService.userLists.findFirst({
          where: {
            customName: update.customName.trim(),
            userId,
            userListId: { not: userListId },
            ...ACTIVE_CONDITION,
          },
        });

        if (check) {
          return {
            status: HttpStatus.BAD_REQUEST,
            data: update.customName + RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
          };
        }
      }

      const { integrations, ...safeUpdate } = update;

      const updated = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.USER_LISTS,
        updateData: { ...safeUpdate, modifiedBy: ADMIN },
        primaryKeyCriteria: { userListId },
        requestId: ADMIN,
        username: ADMIN,
      });

      response.data = updated;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'update user list successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.update,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update user list failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.update,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async delete(userListId: string, userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete user list',
      data: {
        service: UserListsService.name,
        method: MethodNames.delete,
      },
      input: userListId,
    });

    try {
      const existing = await this.prismaService.userLists.findUnique({
        where: {
          userListId_recSeq: {
            userListId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          userId,
        },
      });

      if (!existing) {
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      await this.prismaService.userLists.update({
        where: {
          userListId_recSeq: {
            userListId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          userId,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });

      response.data = RESPONSE_STATUS.SUCCESS.DELETE;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete user list successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.delete,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete user list failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.delete,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async listDropDown(userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    try {
      const lists = await this.prismaService.lists.findMany({
        where: {
          ...ACTIVE_CONDITION,
          name: { not: 'Music' },
          OR: [
            { name: { startsWith: 'Custom' } },
            {
              userLists: {
                none: {
                  userId,
                  ...ACTIVE_CONDITION,
                },
              },
            },
          ],
        },
        select: {
          listId: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      });

      response.data = lists;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'list drop down successfully',
        data: {
          service: UserListsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'list drop down failed',
        data: {
          service: UserListsService.name,
          method: MethodNames.findAll,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
