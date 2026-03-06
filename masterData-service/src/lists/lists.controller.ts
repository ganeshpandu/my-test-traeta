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
import { ListsService } from './lists.service';
import { TechvLogger } from 'techvedika-logger';
import { Response } from 'express';
import { ApiOperation, ApiTags, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { CreateListDto, UpdateListDto, ListFilterDto } from './dto/list.dto';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import { ListEntity, ListListEntity } from './entity/list.entity';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('lists')
@ApiTags('Lists')
export class ListsController {
  constructor(
    private readonly listsService: ListsService,
    private readonly loggerInstance: TechvLogger,
  ) { }

  @Post('/')
  @ApiOperation({ summary: 'Create a new list' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.LIST + RESPONSE_STATUS.SUCCESS.CREATE,
    type: ListEntity,
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
    @Body() createListDto: CreateListDto,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create list',
      data: {
        controller: ListsController.name,
        method: MethodNames.create,
      },
      input: createListDto,
    });
    createListDto.file = file;
    try {
      const result = await this.listsService.create(createListDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create list successfully',
        data: {
          controller: ListsController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create list failed',
        data: {
          controller: ListsController.name,
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
  @ApiOperation({ summary: 'Get all lists' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LIST + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: ListListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async findAll(@Body() listFilterDto: ListFilterDto, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all list',
      data: {
        controller: ListsController.name,
        method: MethodNames.findAll,
      },
      input: listFilterDto,
    });
    try {
      const result = await this.listsService.findAll(listFilterDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all list successfully',
        data: {
          controller: ListsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all list failed',
        data: {
          controller: ListsController.name,
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

  @Get('/:listId')
  @ApiOperation({ summary: 'Get a single list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LIST + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: ListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async findUnique(@Param('listId') listId: string, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique list',
      data: {
        controller: ListsController.name,
        method: MethodNames.findUnique,
      },
      input: listId,
    });
    try {
      const result = await this.listsService.findUnique(listId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique list successfully',
        data: {
          controller: ListsController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique list failed',
        data: {
          controller: ListsController.name,
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

  @Put('/:listId')
  @ApiOperation({ summary: 'Update a list' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LIST + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: ListEntity,
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
    @Param('listId') listId: string,
    @Body() updateListDto: UpdateListDto,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update list',
      data: {
        controller: ListsController.name,
        method: MethodNames.update,
      },
      input: { listId, updateListDto },
    });
    try {
      updateListDto.file = file;
      const result = await this.listsService.update(listId, updateListDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update list successfully',
        data: {
          controller: ListsController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update list failed',
        data: {
          controller: ListsController.name,
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

  @Delete('/:listId')
  @ApiOperation({ summary: 'Delete a list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LIST + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async delete(@Param('listId') listId: string, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete list',
      data: {
        controller: ListsController.name,
        method: MethodNames.delete,
      },
      input: listId,
    });
    try {
      const result = await this.listsService.delete(listId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete list successfully',
        data: {
          controller: ListsController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete list failed',
        data: {
          controller: ListsController.name,
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
