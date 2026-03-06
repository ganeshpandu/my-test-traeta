import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import { CreateListDto, ListFilterDto, UpdateListDto } from './dto/list.dto';
import {
  MethodNames,
  LogType,
  Response,
  RESPONSE_STATUS,
  Metadata,
  ACTIVE_CONDITION,
  REC_SEQ,
  DB_NAME,
  TABLE_NAMES,
  REC_STATUS,
  ADMIN,
} from '../../constants';
import { ListEntity, ListListEntity } from './entity/list.entity';

@Injectable()
export class ListsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createListDto: CreateListDto,
  ): Promise<Response<ListEntity | string>> {
    const response: Response<ListEntity | string> = {
      status: HttpStatus.CREATED,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create lists',
      data: {
        service: ListsService.name,
        method: MethodNames.create,
      },
      input: createListDto,
    });
    try {
      const existingRecord = await this.prismaService.lists.findFirst({
        where: {
          name: createListDto.name,
          ...ACTIVE_CONDITION,
        },
      });
      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create lists already exists',
          data: {
            service: ListsService.name,
            method: MethodNames.create,
          },
          input: createListDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }

      const { file: _, ...dataWithoutFile } = createListDto;

      let listIcon = '';
      if (createListDto.file) {
        const fileUrl = await this.utilityService.uploadFile(createListDto.file);
        listIcon = fileUrl;
      }
      const result = await this.prismaService.lists.create({
        data: { ...dataWithoutFile, listIcon, ...ACTIVE_CONDITION, createdBy: ADMIN },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create lists successfully',
        data: {
          service: ListsService.name,
          method: MethodNames.create,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create lists failed',
        data: {
          service: ListsService.name,
          method: MethodNames.create,
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

  async findAll(
    listFilterDto: ListFilterDto,
  ): Promise<Response<ListListEntity | string>> {
    const response: Response<ListListEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    const metadata: Metadata = {
      pageNumber: 1,
      limit: 1,
      totalCount: 0,
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all lists',
      data: {
        service: ListsService.name,
        method: MethodNames.findAll,
      },
      input: listFilterDto,
    });
    try {
      const { pageNumber, limit, search } = listFilterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;

      const filterConditions = this.utilityService.buildFilter(listFilterDto, [
        'pageNumber',
        'limit',
        'search',
      ]);
      let searchCondition = {};
      if (search && search.trim().length > 0) {
        searchCondition = {
          OR: [
            {
              name: {
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
      const [listsList, totalCount] = await Promise.all([
        this.prismaService.lists.findMany({
          where: whereCondition,
          skip,
          take: limit,
        }),
        this.prismaService.lists.count({
          where: whereCondition,
        }),
      ]);
      const listsWithUrls = await Promise.all(listsList.map(async (item) => {
        if (item.listIcon) {
          try {
            item.listIcon = await this.utilityService.getSignedUrl(item.listIcon);
          } catch (error) {
            console.error(`Error generating signed URL for ${item.listIcon}:`, error);
            item.listIcon = null;
          }
        }
        return item;
      }));
      Object.assign(metadata, { limit, pageNumber, totalCount });
      response.data = {
        data: listsWithUrls,
        metadata,
      };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all lists successfully',
        data: {
          service: ListsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all lists failed',
        data: {
          service: ListsService.name,
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

  async findUnique(listId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique lists',
      data: {
        service: ListsService.name,
        method: MethodNames.findUnique,
      },
      input: listId,
    });
    try {
      const result = await this.prismaService.lists.findUnique({
        where: {
          listId_recSeq: {
            listId: listId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique lists successfully',
        data: {
          service: ListsService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique lists failed',
        data: {
          service: ListsService.name,
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
    listId: string,
    updateListDto: UpdateListDto,
  ): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update lists',
      data: {
        service: ListsService.name,
        method: MethodNames.update,
      },
      input: listId,
    });
    try {
      const existingRecord = await this.prismaService.lists.findUnique({
        where: {
          listId_recSeq: {
            listId: listId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update lists failed',
          data: {
            service: ListsService.name,
            method: MethodNames.update,
          },
          input: listId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      let listIcon = '';
      if (updateListDto.file) {
        const fileUrl = await this.utilityService.uploadFile(updateListDto.file);
        listIcon = fileUrl;
      }
      console.log(listIcon);
      const { file, ...safeUpdate } = updateListDto;
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.LISTS,
        updateData: { ...safeUpdate, listIcon, modifiedBy: ADMIN },
        primaryKeyCriteria: { listId: listId },
        requestId: ADMIN,
        username: ADMIN,
      });
      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update lists successfully',
        data: {
          service: ListsService.name,
          method: MethodNames.update,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update lists failed',
        data: {
          service: ListsService.name,
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

  async delete(listId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete lists',
      data: {
        service: ListsService.name,
        method: MethodNames.delete,
      },
      input: listId,
    });
    try {
      const existingRecord = await this.prismaService.lists.findUnique({
        where: {
          listId_recSeq: {
            listId: listId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete lists failed',
          data: {
            service: ListsService.name,
            method: MethodNames.delete,
          },
          input: listId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      await this.prismaService.lists.update({
        where: {
          listId_recSeq: {
            listId: listId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });
      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete lists successfully',
        data: {
          service: ListsService.name,
          method: MethodNames.delete,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete lists failed',
        data: {
          service: ListsService.name,
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
}
