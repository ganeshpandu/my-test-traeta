import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { TechvLogger } from 'techvedika-logger';
import { VisualizationsService } from './visualizations.service';
import { ReportRequestDto } from './report-request.dto';
import { RESPONSE_STATUS, LogType, MethodNames } from '../../constants';
import { JwtAuthGuard } from '../guards/guards';

@ApiTags('Visualizations')
@Controller('visualizations')
export class VisualizationsController {
  constructor(
    private readonly visualizationsService: VisualizationsService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  @Post('activity')
  @ApiOperation({ summary: 'Get activity report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getActivityReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get activity report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getActivityReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getActivityReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get activity report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getActivityReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get activity report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getActivityReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('lists-and-items')
  @ApiOperation({ summary: 'Get lists and items report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getListsAndItemsReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get lists and items report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getListsAndItemsReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getListsAndItemsReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get lists and items report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getListsAndItemsReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get lists and items report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getListsAndItemsReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('transport')
  @ApiOperation({ summary: 'Get transport report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getTransportReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get transport report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getTransportReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getTransportReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get transport report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getTransportReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get transport report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getTransportReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('travel')
  @ApiOperation({ summary: 'Get travel report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getTravelReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get travel report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getTravelReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getTravelReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get travel report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getTravelReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get travel report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getTravelReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('health')
  @ApiOperation({ summary: 'Get health report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getHealthReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get health report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getHealthReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getHealthReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get health report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getHealthReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get health report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getHealthReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('food')
  @ApiOperation({ summary: 'Get food report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getFoodReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get food report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getFoodReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getFoodReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get food report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getFoodReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get food report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getFoodReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('places-visited')
  @ApiOperation({ summary: 'Get places visited report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getPlacesVisitedReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get places visited report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getPlacesVisitedReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getPlacesVisitedReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get places visited report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getPlacesVisitedReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get places visited report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getPlacesVisitedReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('events')
  @ApiOperation({ summary: 'Get events report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getEventsReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get events report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getEventsReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getEventsReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get events report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getEventsReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get events report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getEventsReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('books')
  @ApiOperation({ summary: 'Get books report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getBooksReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get books report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getBooksReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getBooksReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get books report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getBooksReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get books report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getBooksReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('music')
  @ApiOperation({ summary: 'Get music report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getMusicReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get music report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getMusicReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getMusicReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get music report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getMusicReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get music report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getMusicReport,
        },
        error:
          error instanceof Error
            ? error.message
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error);
    }
  }

  @Post('friends')
  @ApiOperation({ summary: 'Get friends report' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
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
  async getFriendsReport(
    @Body() reportDto: ReportRequestDto,
    @Res() res: Response,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'get friends report',
      data: {
        controller: VisualizationsController.name,
        method: MethodNames.getFriendsReport,
      },
      input: reportDto,
    });
    try {
      const userId = req.user?.userId;
      const result = await this.visualizationsService.getFriendsReport(
        reportDto,
        userId,
      );
      this.loggerInstance.logger(LogType.INFO, {
        message: 'get friends report successfully',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getFriendsReport,
        },
        output: result,
      });
      return res.status(result.status).send({
        statusCode: result.status,
        message:
          RESPONSE_STATUS.VISUALIZATIONS + RESPONSE_STATUS.SUCCESS.FIND_ALL,
        data: result.data,
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get friends report failed',
        data: {
          controller: VisualizationsController.name,
          method: MethodNames.getFriendsReport,
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
