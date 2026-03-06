import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import {
  ACTIVE_CONDITION,
  ADMIN,
  DB_NAME,
  LogType,
  Metadata,
  MethodNames,
  REC_SEQ,
  REC_STATUS,
  RESPONSE_STATUS,
  Response,
  TABLE_NAMES,
} from '../../constants';
import {
  CreateListIntegrationMappingDto,
  ListIntegrationMappingFilterDto,
  UpdateListIntegrationMappingDto,
} from './dto/list-integration-mapping.dto';
import {
  ListIntegrationMappingEntity,
  ListIntegrationMappingListEntity,
} from './entity/list-integration-mapping.entity';

@Injectable()
export class ListIntegrationMappingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createListIntegrationMappingDto: CreateListIntegrationMappingDto,
  ): Promise<Response<ListIntegrationMappingEntity | string>> {
    const response: Response<ListIntegrationMappingEntity | string> = {
      status: HttpStatus.CREATED,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create listintegrationmapping',
      data: {
        service: ListIntegrationMappingService.name,
        method: MethodNames.create,
      },
      input: createListIntegrationMappingDto,
    });
    try {
      const existingRecord =
        await this.prismaService.listIntegrationMapping.findFirst({
          where: {
            listId: createListIntegrationMappingDto.listId,
            integrationId: createListIntegrationMappingDto.integrationId,
            ...ACTIVE_CONDITION,
          },
        });
      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create listintegrationmapping already exists',
          data: {
            service: ListIntegrationMappingService.name,
            method: MethodNames.create,
          },
          input: createListIntegrationMappingDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }
      const result = await this.prismaService.listIntegrationMapping.create({
        data: {
          ...createListIntegrationMappingDto,
          ...ACTIVE_CONDITION,
          createdBy: ADMIN,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create listintegrationmapping successfully',
        data: {
          service: ListIntegrationMappingService.name,
          method: MethodNames.create,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create listintegrationmapping failed',
        data: {
          service: ListIntegrationMappingService.name,
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
    listIntegrationMappingFilterDto: ListIntegrationMappingFilterDto,
  ): Promise<Response<ListIntegrationMappingListEntity | string>> {
    const response: Response<ListIntegrationMappingListEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    const metadata: Metadata = { pageNumber: 1, limit: 1, totalCount: 0 };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all listintegrationmapping',
      data: {
        service: ListIntegrationMappingService.name,
        method: MethodNames.findAll,
      },
      input: listIntegrationMappingFilterDto,
    });
    try {
      const { pageNumber, limit } = listIntegrationMappingFilterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;
      const filterConditions = this.utilityService.buildFilter(
        listIntegrationMappingFilterDto,
        ['pageNumber', 'limit'],
      );
      const whereCondition = { AND: [filterConditions, ACTIVE_CONDITION] };
      const [result, totalCount] = await Promise.all([
        this.prismaService.listIntegrationMapping.findMany({
          where: whereCondition,
          skip,
          take: limit,
        }),
        this.prismaService.listIntegrationMapping.count({
          where: whereCondition,
        }),
      ]);
      Object.assign(metadata, { limit, pageNumber, totalCount });
      response.data = { data: result, metadata };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all listintegrationmapping successfully',
        data: {
          service: ListIntegrationMappingService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all listintegrationmapping failed',
        data: {
          service: ListIntegrationMappingService.name,
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

  async findUnique(listIntegrationMappingId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique listintegrationmapping',
      data: {
        service: ListIntegrationMappingService.name,
        method: MethodNames.findUnique,
      },
      input: listIntegrationMappingId,
    });
    try {
      const result = await this.prismaService.listIntegrationMapping.findUnique(
        {
          where: {
            listIntegrationMappingId_recSeq: {
              listIntegrationMappingId: listIntegrationMappingId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
        },
      );
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique listintegrationmapping successfully',
        data: {
          service: ListIntegrationMappingService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique listintegrationmapping failed',
        data: {
          service: ListIntegrationMappingService.name,
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
    listIntegrationMappingId: string,
    updateListIntegrationMappingDto: UpdateListIntegrationMappingDto,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update listintegrationmapping',
      data: {
        service: ListIntegrationMappingService.name,
        method: MethodNames.update,
      },
      input: { listIntegrationMappingId, updateListIntegrationMappingDto },
    });
    try {
      const existing =
        await this.prismaService.listIntegrationMapping.findUnique({
          where: {
            listIntegrationMappingId_recSeq: {
              listIntegrationMappingId: listIntegrationMappingId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
        });
      if (!existing) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update listintegrationmapping failed',
          data: {
            service: ListIntegrationMappingService.name,
            method: MethodNames.update,
          },
          input: { listIntegrationMappingId, updateListIntegrationMappingDto },
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.LIST_INTEGRATION_MAPPING,
        updateData: { ...updateListIntegrationMappingDto, modifiedBy: ADMIN },
        primaryKeyCriteria: {
          listIntegrationMappingId: listIntegrationMappingId,
        },
        requestId: ADMIN,
        username: ADMIN,
      });
      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update listintegrationmapping successfully',
        data: {
          service: ListIntegrationMappingService.name,
          method: MethodNames.update,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update listintegrationmapping failed',
        data: {
          service: ListIntegrationMappingService.name,
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

  async delete(listIntegrationMappingId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete listintegrationmapping',
      data: {
        service: ListIntegrationMappingService.name,
        method: MethodNames.delete,
      },
      input: listIntegrationMappingId,
    });
    try {
      const existing =
        await this.prismaService.listIntegrationMapping.findUnique({
          where: {
            listIntegrationMappingId_recSeq: {
              listIntegrationMappingId: listIntegrationMappingId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
        });
      if (!existing) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete listintegrationmapping failed',
          data: {
            service: ListIntegrationMappingService.name,
            method: MethodNames.delete,
          },
          input: listIntegrationMappingId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      await this.prismaService.listIntegrationMapping.update({
        where: {
          listIntegrationMappingId_recSeq: {
            listIntegrationMappingId: listIntegrationMappingId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });
      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete listintegrationmapping successfully',
        data: {
          service: ListIntegrationMappingService.name,
          method: MethodNames.delete,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete listintegrationmapping failed',
        data: {
          service: ListIntegrationMappingService.name,
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
