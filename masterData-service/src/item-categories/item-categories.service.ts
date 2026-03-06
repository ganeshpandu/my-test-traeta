import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import {
  ACTIVE_CONDITION,
  ADMIN,
  DB_NAME,
  LogType,
  MethodNames,
  Metadata,
  REC_SEQ,
  REC_STATUS,
  RESPONSE_STATUS,
  Response,
  TABLE_NAMES,
} from '../../constants';
import {
  CreateItemCategoryDto,
  ItemCategoryFilterDto,
  UpdateItemCategoryDto,
} from './dto/item-category.dto';
import {
  ItemCategoryEntity,
  ItemCategoryListEntity,
} from './entity/item-category.entity';

@Injectable()
export class ItemCategoriesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createDto: CreateItemCategoryDto,
  ): Promise<Response<ItemCategoryEntity | string>> {
    const response: Response<ItemCategoryEntity | string> = {
      status: HttpStatus.CREATED,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create itemCategories',
      data: { service: ItemCategoriesService.name, method: MethodNames.create },
      input: createDto,
    });
    try {
      const existingRecord = await this.prismaService.itemCategories.findFirst({
        where: {
          name: createDto.name,
          listId: createDto.listId,
          ...ACTIVE_CONDITION,
        },
      });
      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create itemCategories already exists',
          data: {
            service: ItemCategoriesService.name,
            method: MethodNames.create,
          },
          input: createDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }
      const result = await this.prismaService.itemCategories.create({
        data: { ...createDto, ...ACTIVE_CONDITION, createdBy: ADMIN },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create itemCategories successfully',
        data: {
          service: ItemCategoriesService.name,
          method: MethodNames.create,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create itemCategories failed',
        data: {
          service: ItemCategoriesService.name,
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
    filterDto: ItemCategoryFilterDto,
  ): Promise<Response<ItemCategoryListEntity | string>> {
    const response: Response<ItemCategoryListEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    const metadata: Metadata = { pageNumber: 1, limit: 1, totalCount: 0 };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all itemCategories',
      data: {
        service: ItemCategoriesService.name,
        method: MethodNames.findAll,
      },
      input: filterDto,
    });
    try {
      const { pageNumber, limit, search } = filterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;
      const filterConditions = this.utilityService.buildFilter(filterDto, [
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
      const whereCondition = { AND: [filterConditions, searchCondition, ACTIVE_CONDITION] };
      const [categories, totalCount] = await Promise.all([
        this.prismaService.itemCategories.findMany({
          where: whereCondition,
          skip,
          take: limit,
        }),
        this.prismaService.itemCategories.count({ where: whereCondition }),
      ]);
      Object.assign(metadata, { limit, pageNumber, totalCount });
      response.data = { data: categories, metadata };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all itemCategories successfully',
        data: {
          service: ItemCategoriesService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all itemCategories failed',
        data: {
          service: ItemCategoriesService.name,
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

  async findUnique(itemCategoryId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique itemCategories',
      data: {
        service: ItemCategoriesService.name,
        method: MethodNames.findUnique,
      },
      input: itemCategoryId,
    });
    try {
      const result = await this.prismaService.itemCategories.findUnique({
        where: {
          itemCategoryId_recSeq: {
            itemCategoryId: itemCategoryId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique itemCategories successfully',
        data: {
          service: ItemCategoriesService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique itemCategories failed',
        data: {
          service: ItemCategoriesService.name,
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
    itemCategoryId: string,
    updateItemCategoryDto: UpdateItemCategoryDto,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update itemCategories',
      data: { service: ItemCategoriesService.name, method: MethodNames.update },
      input: { itemCategoryId, updateItemCategoryDto },
    });
    try {
      const existingRecord = await this.prismaService.itemCategories.findUnique(
        {
          where: {
            itemCategoryId_recSeq: {
              itemCategoryId: itemCategoryId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
        },
      );
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update itemCategories failed',
          data: {
            service: ItemCategoriesService.name,
            method: MethodNames.update,
          },
          input: itemCategoryId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.ITEM_CATEGORIES,
        updateData: { ...updateItemCategoryDto, modifiedBy: ADMIN },
        primaryKeyCriteria: { itemCategoryId: itemCategoryId },
        requestId: ADMIN,
        username: ADMIN,
      });
      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update itemCategories successfully',
        data: {
          service: ItemCategoriesService.name,
          method: MethodNames.update,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update itemCategories failed',
        data: {
          service: ItemCategoriesService.name,
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

  async delete(itemCategoryId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete itemCategories',
      data: { service: ItemCategoriesService.name, method: MethodNames.delete },
      input: itemCategoryId,
    });
    try {
      const existingRecord = await this.prismaService.itemCategories.findUnique(
        {
          where: {
            itemCategoryId_recSeq: {
              itemCategoryId: itemCategoryId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
        },
      );
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete itemCategories failed',
          data: {
            service: ItemCategoriesService.name,
            method: MethodNames.delete,
          },
          input: itemCategoryId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      await this.prismaService.itemCategories.update({
        where: {
          itemCategoryId_recSeq: {
            itemCategoryId: itemCategoryId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });
      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete itemCategories successfully',
        data: {
          service: ItemCategoriesService.name,
          method: MethodNames.delete,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete itemCategories failed',
        data: {
          service: ItemCategoriesService.name,
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
