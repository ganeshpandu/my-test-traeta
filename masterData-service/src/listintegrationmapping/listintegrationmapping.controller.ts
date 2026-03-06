import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { TechvLogger } from 'techvedika-logger';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import { ListIntegrationMappingService } from './listintegrationmapping.service';
import {
  CreateListIntegrationMappingDto,
  ListIntegrationMappingFilterDto,
  UpdateListIntegrationMappingDto,
} from './dto/list-integration-mapping.dto';
import {
  ListIntegrationMappingEntity,
  ListIntegrationMappingListEntity,
} from './entity/list-integration-mapping.entity';

@Controller('listintegrationmapping')
@ApiTags('List Integration Mapping')
export class ListIntegrationMappingController {
  constructor(
    private readonly listIntegrationMappingService: ListIntegrationMappingService,
    private readonly loggerInstance: TechvLogger,
  ) { }

  @Post('/')
  @ApiOperation({ summary: 'Create a new list-integration mapping' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      RESPONSE_STATUS.LIST_INTEGRATION_MAPPING + RESPONSE_STATUS.SUCCESS.CREATE,
    type: ListIntegrationMappingEntity,
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
    @Body() createListIntegrationMappingDto: CreateListIntegrationMappingDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create listintegrationmapping',
      data: {
        controller: ListIntegrationMappingController.name,
        method: MethodNames.create,
      },
      input: createListIntegrationMappingDto,
    });
    try {
      const result = await this.listIntegrationMappingService.create(
        createListIntegrationMappingDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create listintegrationmapping successfully',
        data: {
          controller: ListIntegrationMappingController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create listintegrationmapping failed',
        data: {
          controller: ListIntegrationMappingController.name,
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

  @Post('/all')
  @ApiOperation({ summary: 'Get all mappings' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LIST_INTEGRATION_MAPPING +
      RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: ListIntegrationMappingListEntity,
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
    @Body() listIntegrationMappingFilterDto: ListIntegrationMappingFilterDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all listintegrationmapping',
      data: {
        controller: ListIntegrationMappingController.name,
        method: MethodNames.findAll,
      },
      input: listIntegrationMappingFilterDto,
    });
    try {
      const result = await this.listIntegrationMappingService.findAll(
        listIntegrationMappingFilterDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all listintegrationmapping successfully',
        data: {
          controller: ListIntegrationMappingController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all listintegrationmapping failed',
        data: {
          controller: ListIntegrationMappingController.name,
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

  @Get('/:listIntegrationMappingId')
  @ApiOperation({ summary: 'Get mapping by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LIST_INTEGRATION_MAPPING +
      RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: ListIntegrationMappingEntity,
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
    @Param('listIntegrationMappingId') listIntegrationMappingId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique listintegrationmapping',
      data: {
        controller: ListIntegrationMappingController.name,
        method: MethodNames.findUnique,
      },
      input: listIntegrationMappingId,
    });
    try {
      const result = await this.listIntegrationMappingService.findUnique(
        listIntegrationMappingId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique listintegrationmapping successfully',
        data: {
          controller: ListIntegrationMappingController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique listintegrationmapping failed',
        data: {
          controller: ListIntegrationMappingController.name,
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

  @Put('/:listIntegrationMappingId')
  @ApiOperation({ summary: 'Update mapping' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LIST_INTEGRATION_MAPPING + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: ListIntegrationMappingEntity,
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
    @Param('listIntegrationMappingId') listIntegrationMappingId: string,
    @Body() updateListIntegrationMappingDto: UpdateListIntegrationMappingDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update listintegrationmapping',
      data: {
        controller: ListIntegrationMappingController.name,
        method: MethodNames.update,
      },
      input: { listIntegrationMappingId, updateListIntegrationMappingDto },
    });
    try {
      const result = await this.listIntegrationMappingService.update(
        listIntegrationMappingId,
        updateListIntegrationMappingDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update listintegrationmapping successfully',
        data: {
          controller: ListIntegrationMappingController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update listintegrationmapping failed',
        data: {
          controller: ListIntegrationMappingController.name,
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

  @Delete('/:listIntegrationMappingId')
  @ApiOperation({ summary: 'Delete mapping' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LIST_INTEGRATION_MAPPING + RESPONSE_STATUS.SUCCESS.DELETE,
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
    @Param('listIntegrationMappingId') listIntegrationMappingId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete listintegrationmapping',
      data: {
        controller: ListIntegrationMappingController.name,
        method: MethodNames.delete,
      },
      input: listIntegrationMappingId,
    });
    try {
      const result = await this.listIntegrationMappingService.delete(
        listIntegrationMappingId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete listintegrationmapping successfully',
        data: {
          controller: ListIntegrationMappingController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete listintegrationmapping failed',
        data: {
          controller: ListIntegrationMappingController.name,
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
