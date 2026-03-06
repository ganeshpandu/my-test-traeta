import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Get,
  Param,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { TechvLogger } from 'techvedika-logger';
import { Response } from 'express';
import { ApiOperation, ApiTags, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import {
  CreateMasterDataDto,
  MasterDataFilterDto,
  UpdateMasterDataDto,
} from './dto/master-data.dto';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MasterDataEntity,
  MasterDataListEntity,
} from './entity/master-data.entity';

@Controller('master-data')
@ApiTags('Master Data')
export class MasterDataController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  @Post('/')
  @ApiOperation({ summary: 'Create master data' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.MASTER_DATA + RESPONSE_STATUS.SUCCESS.CREATE,
    type: MasterDataEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async create(
    @Body() createMasterDataDto: CreateMasterDataDto,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create masterData',
      data: {
        controller: MasterDataController.name,
        method: MethodNames.create,
      },
      input: createMasterDataDto,
    });
    createMasterDataDto.file = file;
    try {
      const result = await this.masterDataService.create(createMasterDataDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create masterData successfully',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create masterData failed',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.create,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('all')
  @ApiOperation({ summary: 'Get all MasterData' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.MASTER_DATA + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: MasterDataListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async findAll(
    @Body() masterDataFilterDto: MasterDataFilterDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all masterData',
      data: {
        controller: MasterDataController.name,
        method: MethodNames.findAll,
      },
      input: masterDataFilterDto,
    });
    try {
      const result = await this.masterDataService.findAll(masterDataFilterDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all masterData successfully',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all masterData failed',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.findAll,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Get('/:masterDataId')
  @ApiOperation({ summary: 'Get MasterData by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.MASTER_DATA + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: MasterDataEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async findUnique(
    @Param('masterDataId') masterDataId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique masterData',
      data: {
        controller: MasterDataController.name,
        method: MethodNames.findUnique,
      },
      input: masterDataId,
    });
    try {
      const result = await this.masterDataService.findUnique(masterDataId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique masterData successfully',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique masterData failed',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.findUnique,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Put('/:masterDataId')
  @ApiOperation({ summary: 'Update MasterData' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.MASTER_DATA + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: MasterDataEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async update(
    @Param('masterDataId') masterDataId: string,
    @Body() updateMasterDataDto: UpdateMasterDataDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update masterData',
      data: {
        controller: MasterDataController.name,
        method: MethodNames.update,
      },
      input: { masterDataId, updateMasterDataDto },
    });
    try {
      const result = await this.masterDataService.update(
        masterDataId,
        updateMasterDataDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update masterData successfully',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update masterData failed',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.update,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Delete('/:masterDataId')
  @ApiOperation({ summary: 'Delete MasterData' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.MASTER_DATA + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async delete(
    @Param('masterDataId') masterDataId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete masterData',
      data: {
        controller: MasterDataController.name,
        method: MethodNames.delete,
      },
      input: masterDataId,
    });
    try {
      const result = await this.masterDataService.delete(masterDataId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete masterData successfully',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete masterData failed',
        data: {
          controller: MasterDataController.name,
          method: MethodNames.delete,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }
}
