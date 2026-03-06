import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import {
  CreateIntegrationDto,
  IntegrationFilterDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
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
import {
  IntegrationEntity,
  IntegrationListEntity,
} from './entity/integration.entity';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createIntegrationDto: CreateIntegrationDto,
  ): Promise<Response<IntegrationEntity | string>> {
    const response: Response<IntegrationEntity | string> = {
      status: HttpStatus.CREATED,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create integrations',
      data: {
        service: IntegrationsService.name,
        method: MethodNames.create,
      },
      input: createIntegrationDto,
    });
    try {
      const existingRecord = await this.prismaService.integrations.findFirst({
        where: {
          name: createIntegrationDto.name,
          ...ACTIVE_CONDITION,
        },
      });
      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create integrations already exists',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.create,
          },
          input: createIntegrationDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }
      const result = await this.prismaService.integrations.create({
        data: {
          ...createIntegrationDto,
          ...ACTIVE_CONDITION,
          createdBy: ADMIN,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create integrations successfully',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.create,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create integrations failed',
        data: {
          service: IntegrationsService.name,
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
    integrationFilterDto: IntegrationFilterDto,
  ): Promise<Response<IntegrationListEntity | string>> {
    const response: Response<IntegrationListEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    const metadata: Metadata = {
      pageNumber: 1,
      limit: 1,
      totalCount: 0,
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all integrations',
      data: {
        service: IntegrationsService.name,
        method: MethodNames.findAll,
      },
      input: integrationFilterDto,
    });
    try {
      const { pageNumber, limit, search } = integrationFilterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;

      const filterConditions = this.utilityService.buildFilter(
        integrationFilterDto,
        ['pageNumber', 'limit', 'search'],
      );

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
        AND: [filterConditions, searchCondition,ACTIVE_CONDITION],
      };
      const [integrationsList, totalCount] = await Promise.all([
        this.prismaService.integrations.findMany({
          where: whereCondition,
          skip,
          take: limit,
          orderBy: {
            popularity: 'desc',
          },
        }),
        this.prismaService.integrations.count({
          where: whereCondition,
        }),
      ]);
      Object.assign(metadata, { limit, pageNumber, totalCount });
      response.data = {
        data: integrationsList,
        metadata,
      };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all integrations successfully',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all integrations failed',
        data: {
          service: IntegrationsService.name,
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

  async findUnique(integrationId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique  integrations',
      data: {
        service: IntegrationsService.name,
        method: MethodNames.findUnique,
      },
      input: integrationId,
    });
    try {
      const result = await this.prismaService.integrations.findUnique({
        where: {
          integrationId_recSeq: {
            integrationId: integrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique integrations successfully',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique integrations failed',
        data: {
          service: IntegrationsService.name,
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
    integrationId: string,
    updateIntegrationDto: UpdateIntegrationDto,
  ): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update integrations',
      data: {
        service: IntegrationsService.name,
        method: MethodNames.update,
      },
      input: { integrationId, updateIntegrationDto },
    });
    try {
      const existingRecord = await this.prismaService.integrations.findUnique({
        where: {
          integrationId_recSeq: {
            integrationId: integrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update integrations failed',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.update,
          },
          input: integrationId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.INTEGRATIONS,
        updateData: { ...updateIntegrationDto, modifiedBy: ADMIN },
        primaryKeyCriteria: { integrationId: integrationId },
        requestId: ADMIN,
        username: ADMIN,
      });
      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update integrations successfully',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.update,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update integrations failed',
        data: {
          service: IntegrationsService.name,
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

  async delete(integrationId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete integrations',
      data: {
        service: IntegrationsService.name,
        method: MethodNames.delete,
      },
      input: integrationId,
    });
    try {
      const existingRecord = await this.prismaService.integrations.findUnique({
        where: {
          integrationId_recSeq: {
            integrationId: integrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete integrations failed',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.delete,
          },
          input: integrationId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      await this.prismaService.integrations.update({
        where: {
          integrationId_recSeq: {
            integrationId: integrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });
      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete integrations successfully',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.delete,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete integrations failed',
        data: {
          service: IntegrationsService.name,
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
