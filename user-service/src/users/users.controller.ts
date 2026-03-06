import {
  Controller,
  Put,
  Body,
  HttpStatus,
  Res,
  Req,
  UseGuards,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { TechvLogger } from 'techvedika-logger';
import { Response } from 'express';
import type { Request } from 'express';
import { UpdateUserDto } from './dto/users.dto';
import { LogType, MethodNames, RESPONSE_STATUS } from '../../constants';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/guards';
import { UsersEntity } from './entity/users.entity';

@Controller('profile')
@ApiTags('User Profile')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly loggerInstance: TechvLogger,
  ) { }

  @Put('/')
  @ApiOperation({
    summary: 'Update User Profile',
    description:
      "Updates the authenticated user's profile information including email, phone, name, avatar, etc.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.UPDATE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing Firebase token',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @Body() updateUserDto: UpdateUserDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ): Promise<Response<any>> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update user',
      data: {
        service: UsersService.name,
        method: MethodNames.update,
      },
      input: { updateUserDto },
    });
    try {
      const userId = req.user?.userId;
      const result = await this.usersService.update(userId, updateUserDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update user successfully',
        data: {
          service: UsersService.name,
          method: MethodNames.update,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update user failed',
        data: {
          service: UsersService.name,
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

  @Get('/')
  @ApiOperation({
    summary: 'Get User Profile',
    description:
      "Retrieves the authenticated user's complete profile information",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.FIND_UNIQUE,
    type: UsersEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing Firebase token',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findUnique(
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ): Promise<Response<UsersEntity | string>> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'findUnique user',
      data: {
        service: UsersService.name,
        method: MethodNames.findUnique,
      },
      input: {},
    });
    try {
      const userId = req.user?.userId;
      const result = await this.usersService.findUnique(userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'findUnique user successfully',
        data: {
          service: UsersService.name,
          method: MethodNames.findUnique,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'findUnique user failed',
        data: {
          service: UsersService.name,
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

  @Delete('/')
  @ApiOperation({
    summary: 'Delete User Account',
    description:
      "Permanently deletes the authenticated user's account and all associated data",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.DELETE,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing Firebase token',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async delete(
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ): Promise<Response<any>> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete user',
      data: {
        service: UsersService.name,
        method: MethodNames.delete,
      },
      input: {},
    });
    try {
      const userId = req.user?.userId;
      const result = await this.usersService.delete(userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete user successfully',
        data: {
          service: UsersService.name,
          method: MethodNames.delete,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete user failed',
        data: {
          service: UsersService.name,
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
