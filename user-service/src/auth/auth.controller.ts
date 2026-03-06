//controller
import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RefreshDto, SignDto } from './dto/auth.dto';
import { TechvLogger } from 'techvedika-logger';
import { LogType, RESPONSE_STATUS } from '../../constants';
import { RefreshEntity, SignEntity } from './entity/auth.entity';
import { MethodNames } from '../../constants';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  @Post('verifyuser')
  @ApiOperation({ summary: 'Sign up' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.USER +
      RESPONSE_STATUS.SIGNUP +
      RESPONSE_STATUS.SIGNIN +
      RESPONSE_STATUS.SUCCESSFUL,
    type: SignEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  async verifyUser(@Body() signDto: SignDto, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'verifyuser',
      data: {
        controller: AuthController.name,
        method: MethodNames.verifyUser,
      },
      input: signDto,
    });
    try {
      const result = await this.authService.verifyUser(signDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'verified user successfully',
        data: {
          controller: AuthController.name,
          method: MethodNames.verifyUser,
        },
        output: result,
      });
      return res.status(result.status).send(result.data);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'verified user failed',
        data: {
          controller: AuthController.name,
          method: MethodNames.verifyUser,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh Token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.TOKEN +
      RESPONSE_STATUS.REFRESH +
      RESPONSE_STATUS.SUCCESSFUL,
    type: RefreshEntity,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  refreshToken(@Body() refreshTokenDto: RefreshDto, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'RefreshToken',
      data: {
        controller: AuthController.name,
        method: MethodNames.refreshToken,
      },
      input: refreshTokenDto,
    });
    try {
      const result = this.authService.refreshToken(refreshTokenDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'RefreshToken successfully',
        data: {
          controller: AuthController.name,
          method: MethodNames.refreshToken,
        },
        output: result,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'RefreshToken failed',
        data: {
          controller: AuthController.name,
          method: MethodNames.refreshToken,
        },
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.USER +
      RESPONSE_STATUS.LOGOUT +
      RESPONSE_STATUS.SUCCESSFUL,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: RESPONSE_STATUS.ERROR.BAD_REQUEST,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
  })
  logout(@Body() logoutDto: RefreshDto, @Res() res: Response) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Logout',
      data: { controller: AuthController.name, method: MethodNames.logout },
      input: logoutDto,
    });
    try {
      const result = this.authService.logout(logoutDto);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Logout successfully',
        data: { controller: AuthController.name, method: MethodNames.logout },
        output: result,
      });
      return res.status(result.status).json(result);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Logout failed',
        data: { controller: AuthController.name, method: MethodNames.logout },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: error instanceof Error ? error.message : 'Internal Server Error',
      });
    }
  }
}
