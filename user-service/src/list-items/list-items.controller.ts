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
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TechvLogger } from 'techvedika-logger';
import { ListItemsService } from './list-items.service';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import {
  CreateListItemDto,
  ListItemFilterDto,
  UpdateListItemDto,
  ListItemsByDateFilterDto,
  DeleteListItemDto,
} from './dto/list-items.dto';
import { ListItemEntity, ListItemListEntity } from './entity/list-items.entity';
import { JwtAuthGuard } from '../guards/guards';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('List Items')
@Controller('listitems')
export class ListItemsController {
  constructor(
    private readonly listItemsService: ListItemsService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  @Post('/')
  @ApiOperation({ summary: 'Create list item' })
  @UseInterceptors(FilesInterceptor('images')) // 'files' is the field name in FormData
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.CREATE,
    type: ListItemEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createListItemDto: CreateListItemDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create list item',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.create,
      },
      input: createListItemDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.create(
        createListItemDto,
        userId,
        images,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create list item successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create list item failed',
        data: {
          controller: ListItemsController.name,
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
  @ApiOperation({ summary: 'Get all list items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: ListItemListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Body() listItemFilterDto: ListItemFilterDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all list items',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.findAll,
      },
      input: listItemFilterDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.findAll(
        listItemFilterDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all list items successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all list items failed',
        data: {
          controller: ListItemsController.name,
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

  @Post('listItemsByDate')
  @ApiOperation({ summary: 'Fetch list items (Songs) by date' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: [ListItemEntity],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async fetchListItemsByDate(
    @Body() listItemsByDateFilterDto: ListItemsByDateFilterDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'fetch list items (Songs) by date',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.findAll,
      },
      input: listItemsByDateFilterDto,
    });
    try {
      const result = await this.listItemsService.fetchListItemsByDate(
        listItemsByDateFilterDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'fetch music opened items successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'fetch music opened items failed',
        data: {
          controller: ListItemsController.name,
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

  @Get('/itemListDropDown')
  @ApiOperation({ summary: 'Get dropdown of item list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.FIND_ALL,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async itemListDropDown(
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'item list dropdown',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.findAll,
      },
      input: req.user?.userId,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.itemListDropDown(userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'item list dropdown successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'item list dropdown failed',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.findAll,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('/:listItemId')
  @ApiOperation({ summary: 'Get list item by composite id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: ListItemEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findUnique(
    @Param('listItemId') listItemId: string,
    @Res() res: Response,
  ) {
    return this.findUniqueWithDate(listItemId, undefined, res);
  }

  @Get('/:listItemId/:date')
  @ApiOperation({ summary: 'Get list item by composite id with date' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: ListItemEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findUniqueWithDate(
    @Param('listItemId') listItemId: string,
    @Param('date') date: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique list item',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.findUnique,
      },
      input: { listItemId },
    });
    try {
      const extractedDate = date ? date.split('T')[0] : undefined;
      const result = await this.listItemsService.findUnique(
        listItemId,
        extractedDate,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique list item successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique list item failed',
        data: {
          controller: ListItemsController.name,
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

  @Put('/:listItemId')
  @ApiOperation({ summary: 'Update list item' })
  @UseInterceptors(FilesInterceptor('files')) // 'files' is the field name in FormData
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: ListItemEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('listItemId') listItemId: string,
    @Body() updateListItemDto: UpdateListItemDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update list item',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.update,
      },
      input: { listItemId, updateListItemDto },
    });
    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.update(
        listItemId,
        updateListItemDto,
        userId,
        images,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update list item successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update list item failed',
        data: {
          controller: ListItemsController.name,
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

  @Delete('/:listItemId')
  @ApiOperation({ summary: 'Delete list item' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('listItemId') listItemId: string,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete list item',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.delete,
      },
      input: { listItemId, userId: req.user?.userId },
    });
    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.delete(listItemId, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete list item successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete list item failed',
        data: {
          controller: ListItemsController.name,
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

  @Post('delete')
  @ApiOperation({ summary: 'Delete many list items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.LISTITEMS + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: RESPONSE_STATUS.ERROR.FORBIDDEN,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async deleteMany(
    @Body() deleteDto: DeleteListItemDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete many list items',
      data: {
        controller: ListItemsController.name,
        method: MethodNames.delete,
      },
      input: { deleteDto, userId: req.user?.userId },
    });
    try {
      const userId = req.user?.userId;
      const result = await this.listItemsService.deleteMany(deleteDto, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete many list items successfully',
        data: {
          controller: ListItemsController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete many list items failed',
        data: {
          controller: ListItemsController.name,
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
