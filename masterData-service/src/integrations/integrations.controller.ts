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
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { TechvLogger } from 'techvedika-logger';
import { Response } from 'express';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationFilterDto,
} from './dto/integration.dto';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import {
  IntegrationEntity,
  IntegrationListEntity,
} from './entity/integration.entity';

@Controller('integration')
@ApiTags('Integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly loggerInstance: TechvLogger,
  ) { }

  @Post('/')
  @ApiOperation({ summary: 'Create integration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.INTEGRATION + RESPONSE_STATUS.SUCCESS.CREATE,
    type: IntegrationEntity,
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
    @Body() createIntegrationDto: CreateIntegrationDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create integration',
      data: {
        controller: IntegrationsController.name,
        method: MethodNames.create,
      },
      input: createIntegrationDto,
    });
    try {
      const result =
        await this.integrationsService.create(createIntegrationDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create integration successfully',
        data: {
          controller: IntegrationsController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create integration failed',
        data: {
          controller: IntegrationsController.name,
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
  @ApiOperation({ summary: 'Get all integrations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.INTEGRATION + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: IntegrationListEntity,
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
    @Body() integrationFilterDto: IntegrationFilterDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all integration',
      data: {
        controller: IntegrationsController.name,
        method: MethodNames.findAll,
      },
      input: integrationFilterDto,
    });
    try {
      const result =
        await this.integrationsService.findAll(integrationFilterDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all integration successfully',
        data: {
          controller: IntegrationsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all integration failed',
        data: {
          controller: IntegrationsController.name,
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

  @Get('/:integrationId')
  @ApiOperation({ summary: 'Get integration by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.INTEGRATION + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: IntegrationEntity,
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
    @Param('integrationId') integrationId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique integration',
      data: {
        controller: IntegrationsController.name,
        method: MethodNames.findUnique,
      },
      input: integrationId,
    });
    try {
      const result = await this.integrationsService.findUnique(integrationId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique  integration successfully',
        data: {
          controller: IntegrationsController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique integration failed',
        data: {
          controller: IntegrationsController.name,
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

  @Put('/:integrationId')
  @ApiOperation({ summary: 'Update integration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.INTEGRATION + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: IntegrationEntity,
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
    @Param('integrationId') integrationId: string,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update integration',
      data: {
        controller: IntegrationsController.name,
        method: MethodNames.update,
      },
      input: { integrationId, updateIntegrationDto },
    });
    try {
      const result = await this.integrationsService.update(
        integrationId,
        updateIntegrationDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update integration successfully',
        data: {
          controller: IntegrationsController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update integration failed',
        data: {
          controller: IntegrationsController.name,
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

  @Delete('/:integrationId')
  @ApiOperation({ summary: 'Delete integration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.INTEGRATION + RESPONSE_STATUS.SUCCESS.DELETE,
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
    @Param('integrationId') integrationId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete integration',
      data: {
        controller: IntegrationsController.name,
        method: MethodNames.delete,
      },
      input: integrationId,
    });
    try {
      const result = await this.integrationsService.delete(integrationId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete integration successfully',
        data: {
          controller: IntegrationsController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete integration failed',
        data: {
          controller: IntegrationsController.name,
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
