import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import {
  CreateMasterDataDto,
  MasterDataFilterDto,
  UpdateMasterDataDto,
} from './dto/master-data.dto';
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
  AVATAR,
} from '../../constants';
import {
  MasterDataEntity,
  MasterDataListEntity,
} from './entity/master-data.entity';

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) { }

  async create(
    createMasterDataDto: CreateMasterDataDto
  ): Promise<Response<MasterDataEntity | string>> {
    const response: Response<MasterDataEntity | string> = {
      status: HttpStatus.CREATED,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create masterData',
      data: {
        service: MasterDataService.name,
        method: MethodNames.create,
      },
      input: createMasterDataDto,
    });
    try {
      const existingRecord = await this.prismaService.masterData.findFirst({
        where: {
          keyCode: createMasterDataDto.keyCode,
          value: createMasterDataDto.value,
          ...ACTIVE_CONDITION,
        },
      });
      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create masterData already exists',
          data: {
            service: MasterDataService.name,
            method: MethodNames.create,
          },
          input: createMasterDataDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }

      const { file: _, ...dataWithoutFile } = createMasterDataDto;

      if (createMasterDataDto.file) {
        const fileUrl = await this.utilityService.uploadFile(createMasterDataDto.file);
        dataWithoutFile.value = fileUrl;
      }

      const result = await this.prismaService.masterData.create({
        data: { ...dataWithoutFile, ...ACTIVE_CONDITION, createdBy: ADMIN },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create masterData successfully',
        data: {
          service: MasterDataService.name,
          method: MethodNames.create,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create masterData failed',
        data: {
          service: MasterDataService.name,
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
    masterDataFilterDto: MasterDataFilterDto,
  ): Promise<Response<MasterDataListEntity | string>> {
    const response: Response<MasterDataListEntity | string> = {
      status: HttpStatus.OK,
      data: '',
    };
    const metadata: Metadata = {
      pageNumber: 1,
      limit: 1,
      totalCount: 0,
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all masterData',
      data: {
        service: MasterDataService.name,
        method: MethodNames.findAll,
      },
      input: masterDataFilterDto,
    });
    try {
      const { pageNumber, limit, search } = masterDataFilterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;

      const filterConditions = this.utilityService.buildFilter(
        masterDataFilterDto,
        ['pageNumber', 'limit', 'search'],
      );
      let searchCondition = {};
      if (search && search.trim().length > 0) {
        searchCondition = {
          OR: [
            {
              keyCode: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              value: {
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
      const [masterDataList, totalCount] = await Promise.all([
        this.prismaService.masterData.findMany({
          where: whereCondition,
          skip,
          take: limit,
        }),
        this.prismaService.masterData.count({
          where: whereCondition,
        }),
      ]);
      const masterDataWithUrls = await Promise.all(masterDataList.map(async (item) => {
        if (item.value && item.keyCode == AVATAR) {
          try {
            item.value = await this.utilityService.getSignedUrl(item.value);
          } catch (error) {
            console.error(`Error generating signed URL for ${item.value}:`, error);
            item.value = null;
          }
        }
        return item;
      }));
      Object.assign(metadata, { limit, pageNumber, totalCount });
      response.data = {
        data: masterDataWithUrls,
        metadata,
      };
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all masterData successfully',
        data: {
          service: MasterDataService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all masterData failed',
        data: {
          service: MasterDataService.name,
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

  async findUnique(masterDataId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique masterData',
      data: {
        service: MasterDataService.name,
        method: MethodNames.findUnique,
      },
      input: masterDataId,
    });
    try {
      const result = await this.prismaService.masterData.findUnique({
        where: {
          masterDataId_recSeq: {
            masterDataId: masterDataId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique masterData successfully',
        data: {
          service: MasterDataService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique masterData failed',
        data: {
          service: MasterDataService.name,
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
    masterDataId: string,
    updateMasterDataDto: UpdateMasterDataDto,
  ): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update masterData',
      data: {
        service: MasterDataService.name,
        method: MethodNames.update,
      },
      input: masterDataId,
    });
    try {
      const existingRecord = await this.prismaService.masterData.findUnique({
        where: {
          masterDataId_recSeq: {
            masterDataId: masterDataId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update masterData failed',
          data: {
            service: MasterDataService.name,
            method: MethodNames.update,
          },
          input: masterDataId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.MASTER_DATA,
        updateData: { ...updateMasterDataDto, modifiedBy: ADMIN },
        primaryKeyCriteria: { masterDataId: masterDataId },
        requestId: ADMIN,
        username: ADMIN,
      });
      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update masterData successfully',
        data: {
          service: MasterDataService.name,
          method: MethodNames.update,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update masterData failed',
        data: {
          service: MasterDataService.name,
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

  async delete(masterDataId: string): Promise<Response<any>> {
    const response: Response<any> = {
      status: HttpStatus.OK,
      data: '',
    };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete masterData',
      data: {
        service: MasterDataService.name,
        method: MethodNames.delete,
      },
      input: masterDataId,
    });
    try {
      const existingRecord = await this.prismaService.masterData.findUnique({
        where: {
          masterDataId_recSeq: {
            masterDataId: masterDataId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete masterData failed',
          data: {
            service: MasterDataService.name,
            method: MethodNames.delete,
          },
          input: masterDataId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }
      await this.prismaService.masterData.update({
        where: {
          masterDataId_recSeq: {
            masterDataId: masterDataId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });
      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete masterData successfully',
        data: {
          service: MasterDataService.name,
          method: MethodNames.delete,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete masterData failed',
        data: {
          service: MasterDataService.name,
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
