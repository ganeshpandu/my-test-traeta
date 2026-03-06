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
import { LogType, MethodNames, RESPONSE_STATUS } from '../../constants';
import { ItemCategoriesService } from './item-categories.service';
import {
  CreateItemCategoryDto,
  ItemCategoryFilterDto,
  UpdateItemCategoryDto,
} from './dto/item-category.dto';
import {
  ItemCategoryEntity,
  ItemCategoryListEntity,
} from './entity/item-category.entity';

@Controller('item-categories')
@ApiTags('Item Categories')
export class ItemCategoriesController {
  constructor(
    private readonly itemCategoriesService: ItemCategoriesService,
    private readonly loggerInstance: TechvLogger,
  ) { }

  @Post('/')
  @ApiOperation({ summary: 'Create item category' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.ITEM_CATEGORY + RESPONSE_STATUS.SUCCESS.CREATE,
    type: ItemCategoryEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async create(@Body() createDto: CreateItemCategoryDto, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create item-category',
      data: {
        controller: ItemCategoriesController.name,
        method: MethodNames.create,
      },
      input: createDto,
    });
    try {
      const result = await this.itemCategoriesService.create(createDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create item-category successfully',
        data: {
          controller: ItemCategoriesController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create item-category failed',
        data: {
          controller: ItemCategoriesController.name,
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
  @ApiOperation({ summary: 'Get all item categories' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.ITEM_CATEGORY + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: ItemCategoryListEntity,
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
    @Body() filterDto: ItemCategoryFilterDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all item-category',
      data: {
        controller: ItemCategoriesController.name,
        method: MethodNames.findAll,
      },
      input: filterDto,
    });
    try {
      const result = await this.itemCategoriesService.findAll(filterDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all item-category successfully',
        data: {
          controller: ItemCategoriesController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all item-category failed',
        data: {
          controller: ItemCategoriesController.name,
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

  @Get('/:itemCategoryId')
  @ApiOperation({ summary: 'Get item category by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.ITEM_CATEGORY + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: ItemCategoryEntity,
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
    @Param('itemCategoryId') itemCategoryId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique item-category',
      data: {
        controller: ItemCategoriesController.name,
        method: MethodNames.findUnique,
      },
      input: itemCategoryId,
    });
    try {
      const result =
        await this.itemCategoriesService.findUnique(itemCategoryId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique item-category successfully',
        data: {
          controller: ItemCategoriesController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique item-category failed',
        data: {
          controller: ItemCategoriesController.name,
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

  @Put('/:itemCategoryId')
  @ApiOperation({ summary: 'Update item category' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.ITEM_CATEGORY + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: ItemCategoryEntity,
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
    @Param('itemCategoryId') itemCategoryId: string,
    @Body() updateDto: UpdateItemCategoryDto,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update item-category',
      data: {
        controller: ItemCategoriesController.name,
        method: MethodNames.update,
      },
      input: { itemCategoryId, updateDto },
    });
    try {
      const result = await this.itemCategoriesService.update(
        itemCategoryId,
        updateDto,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update item-category successfully',
        data: {
          controller: ItemCategoriesController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update item-category failed',
        data: {
          controller: ItemCategoriesController.name,
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

  @Delete('/:itemCategoryId')
  @ApiOperation({ summary: 'Delete item category' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.ITEM_CATEGORY + RESPONSE_STATUS.SUCCESS.DELETE,
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
    @Param('itemCategoryId') itemCategoryId: string,
    @Res() res: Response,
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete item-category',
      data: {
        controller: ItemCategoriesController.name,
        method: MethodNames.delete,
      },
      input: itemCategoryId,
    });
    try {
      const result = await this.itemCategoriesService.delete(itemCategoryId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete item-category successfully',
        data: {
          controller: ItemCategoriesController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete item-category failed',
        data: {
          controller: ItemCategoriesController.name,
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
