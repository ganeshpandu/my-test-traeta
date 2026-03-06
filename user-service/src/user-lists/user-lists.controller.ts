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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TechvLogger } from 'techvedika-logger';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import { UserListsService } from './user-lists.service';
import {
  CreateUserListDto,
  UpdateUserListDto,
  UserListFilterDto,
} from './dto/user-lists.dto';
import { UserListEntity, UserListListEntity } from './entity/user-lists.entity';
import { JwtAuthGuard } from '../guards/guards';

@Controller('user-lists')
@ApiTags('User Lists')
export class UserListsController {
  constructor(
    private readonly userListsService: UserListsService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  @Post('/')
  @ApiOperation({ summary: 'Create user list with optional integrations' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.CREATE,
    type: UserListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateUserListDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create user list',
      data: {
        controller: UserListsController.name,
        method: MethodNames.create,
      },
      input: dto,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.create(dto, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create user list successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.create,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create user list failed',
        data: {
          controller: UserListsController.name,
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
  @ApiOperation({ summary: 'Get all user lists with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.FIND_ALL,
    type: UserListListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Body() filter: UserListFilterDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all user lists',
      data: {
        controller: UserListsController.name,
        method: MethodNames.findAll,
      },
      input: filter,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.findAll(filter, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all user lists successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all user lists failed',
        data: {
          controller: UserListsController.name,
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

  @Get('/listDropdown')
  @ApiOperation({ summary: 'Get dropdown of list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.FIND_ALL,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async listDropDown(
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'list dropdown',
      data: {
        controller: UserListsController.name,
        method: MethodNames.findAll,
      },
      input: req.user?.userId,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.listDropDown(userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'list dropdown successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.findAll,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'list dropdown failed',
        data: {
          controller: UserListsController.name,
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

  @Get('/:userListId')
  @ApiOperation({ summary: 'Get a single user list by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: UserListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findUnique(
    @Param('userListId') userListId: string,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique user list',
      data: {
        controller: UserListsController.name,
        method: MethodNames.findUnique,
      },
      input: userListId,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.findUnique(userListId, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique user list successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique user list failed',
        data: {
          controller: UserListsController.name,
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

  @Put('/:userListId')
  @ApiOperation({ summary: 'Update user list (e.g. customName)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.UPDATE,
    type: UserListEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('userListId') userListId: string,
    @Body() update: UpdateUserListDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update user list',
      data: {
        controller: UserListsController.name,
        method: MethodNames.update,
      },
      input: { userListId, update },
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.update(
        userListId,
        update,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update user list successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update user list failed',
        data: {
          controller: UserListsController.name,
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

  @Delete('/:userListId')
  @ApiOperation({ summary: 'Delete user list (soft delete)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('userListId') userListId: string,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete user list',
      data: {
        controller: UserListsController.name,
        method: MethodNames.delete,
      },
      input: userListId,
    });

    try {
      const userId = req.user?.userId;
      const result = await this.userListsService.delete(userListId, userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete user list successfully',
        data: {
          controller: UserListsController.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete user list failed',
        data: {
          controller: UserListsController.name,
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
