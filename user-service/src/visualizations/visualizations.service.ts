import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import {
  ACTIVE_CONDITION,
  LogType,
  MethodNames,
  REC_SEQ,
  RESPONSE_STATUS,
  Response,
  ActivityEntry,
  MONTH_NAMES,
} from '../../constants';
import { Prisma } from '@prisma/client';
import { ReportRequestDto } from './report-request.dto';

@Injectable()
export class VisualizationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) { }

  private capPeriodEndToToday(periodEnd: Date): Date {
    const now = new Date();
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    return periodEnd.getTime() > todayEnd.getTime() ? todayEnd : periodEnd;
  }

  private parseDateTimeValue(
    dateValue: unknown,
    timeValue: unknown,
  ): Date | null {
    const parsedDate = this.parseDateValue(dateValue);
    if (!parsedDate) return null;

    if (!timeValue || typeof timeValue !== 'string') {
      return parsedDate;
    }

    const timeStr = timeValue.trim().toLowerCase();
    if (!timeStr) {
      return parsedDate;
    }

    const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = timeStr.match(timeRegex);

    if (!match) {
      return parsedDate;
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const meridiem = match[4]?.toLowerCase();

    if (meridiem === 'pm' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }

    const result = new Date(parsedDate);
    result.setUTCHours(hours, minutes, seconds, 0);
    return result;
  }

  private parseDateValue(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private parseDurationString(value: string): number | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;

    let totalHours = 0;

    const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/);
    if (hourMatch) {
      totalHours += parseFloat(hourMatch[1]);
    }

    const minMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
    if (minMatch) {
      totalHours += parseFloat(minMatch[1]) / 60;
    }

    const secMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:onds?)?)?/);
    if (secMatch) {
      totalHours += parseFloat(secMatch[1]) / 3600;
    }

    return totalHours > 0 ? totalHours : null;
  }

  private extractAttributes(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private computeDurationHours(
    attrs: Record<string, unknown>,
    start: Date | null,
    end: Date | null,
  ): number {
    const durationStringKeys = ['activityDuration', 'elapsedDuration'];
    for (const key of durationStringKeys) {
      const value = attrs[key];
      if (typeof value === 'string') {
        const parsed = this.parseDurationString(value);
        if (parsed !== null && parsed > 0) {
          return parsed;
        }
      }
    }

    const hourKeys = ['hours', 'hoursSpent', 'totalHours'];
    for (const key of hourKeys) {
      const numeric = this.toNumber(attrs[key]);
      if (numeric !== null && numeric > 0) {
        return numeric;
      }
    }

    const minuteKeys = [
      'durationMinutes',
      'durationMin',
      'duration',
      'minutes',
      'totalMinutes',
    ];
    for (const key of minuteKeys) {
      const numeric = this.toNumber(attrs[key]);
      if (numeric !== null && numeric > 0) {
        return numeric / 60;
      }
    }

    const secondKeys = [
      'durationSeconds',
      'durationSec',
      'seconds',
      'totalSeconds',
    ];
    for (const key of secondKeys) {
      const numeric = this.toNumber(attrs[key]);
      if (numeric !== null && numeric > 0) {
        return numeric / 3600;
      }
    }

    if (start && end) {
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (diff > 0) {
        return diff;
      }
    }

    return 0;
  }

  private resolveActivityName(
    categoryName: string | null | undefined,
    title: string | null | undefined,
    attrs: Record<string, unknown>,
  ): string {
    if (typeof categoryName === 'string' && categoryName.trim().length > 0) {
      return categoryName;
    }

    const keys = ['activityType', 'type', 'category', 'name'];
    for (const key of keys) {
      const value = attrs[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    if (typeof title === 'string' && title.trim().length > 0) {
      return title;
    }

    return 'Other';
  }

  private roundHours(value: number): number {
    return Math.floor(value * 100) / 100;
  }

  private roundToTwoDecimals(value: number): number {
    return Math.floor(value * 100) / 100;
  }

  private mapToActivityArray(
    map: Map<string, number>,
    allActivities?: Iterable<string>,
  ): Array<{ activity_name: string; hours_spent: number }> {
    const resultMap = new Map(map);
    if (allActivities) {
      for (const activityName of allActivities) {
        if (!resultMap.has(activityName)) {
          resultMap.set(activityName, 0);
        }
      }
    }

    return Array.from(resultMap.entries())
      .map(([activityName, hours]) => ({
        activity_name: activityName,
        hours_spent: this.roundHours(hours),
      }))
      .sort((a, b) =>
        b.hours_spent === a.hours_spent
          ? a.activity_name.localeCompare(b.activity_name)
          : b.hours_spent - a.hours_spent,
      );
  }

  private buildWeeklyReport(
    entries: ActivityEntry[],
    periodStart: Date,
    periodEnd: Date,
    allActivities: Iterable<string>,
  ) {
    const report: Array<{
      sequence_label: string;
      start_date: string;
      end_date: string;
      acivities_hours: Array<{ activity_name: string; hours_spent: number }>;
    }> = [];
    const totals: number[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    let weekStart = new Date(periodStart);
    weekStart.setUTCHours(0, 0, 0, 0);
    let index = 1;

    while (weekStart.getTime() <= periodEnd.getTime()) {
      const endOfWeek = new Date(weekStart);
      const daysToSunday = (7 - endOfWeek.getUTCDay()) % 7;
      // const daysToSunday = (7 - endOfWeek.getUTCDay()) % 7;
      //Sunday
      endOfWeek.setUTCDate(endOfWeek.getUTCDate() + daysToSunday);
      endOfWeek.setUTCHours(23, 59, 59, 999);
      const weekEndMs = Math.min(periodEnd.getTime(), endOfWeek.getTime());
      const weekEnd = new Date(weekEndMs);
      const activityMap = new Map<string, number>();

      for (const entry of entries) {
        const time = entry.start.getTime();
        if (time >= weekStart.getTime() && time <= weekEndMs) {
          activityMap.set(
            entry.activityName,
            (activityMap.get(entry.activityName) ?? 0) + entry.hours,
          );
        }
      }

      const rawTotal = Array.from(activityMap.values()).reduce(
        (sum, value) => sum + value,
        0,
      );
      totals.push(rawTotal);

      report.push({
        sequence_label: `Week ${index}`,
        start_date: this.utilityService.formatDate(weekStart),
        end_date: this.utilityService.formatDate(weekEnd),
        acivities_hours: this.mapToActivityArray(activityMap, allActivities),
      });

      const nextStart = new Date(weekEndMs + dayMs);
      nextStart.setUTCHours(0, 0, 0, 0);
      weekStart = nextStart;
      index++;
    }

    return { report, totals };
  }

  private buildMonthlyReport(
    entries: ActivityEntry[],
    year: number,
    allActivities: Iterable<string>,
  ) {
    const report: Array<{
      sequence_label: string;
      start_date: string;
      end_date: string;
      acivities_hours: Array<{ activity_name: string; hours_spent: number }>;
    }> = [];
    const totals: number[] = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEndBoundary = new Date(
        Date.UTC(year, month + 1, 0, 23, 59, 59, 999),
      );
      const monthEnd = new Date(Date.UTC(year, month + 1, 0));
      const activityMap = new Map<string, number>();

      for (const entry of entries) {
        const time = entry.start.getTime();
        if (
          time >= monthStart.getTime() &&
          time <= monthEndBoundary.getTime()
        ) {
          activityMap.set(
            entry.activityName,
            (activityMap.get(entry.activityName) ?? 0) + entry.hours,
          );
        }
      }

      const rawTotal = Array.from(activityMap.values()).reduce(
        (sum, value) => sum + value,
        0,
      );
      totals.push(rawTotal);

      report.push({
        sequence_label: MONTH_NAMES[month],
        start_date: this.utilityService.formatDate(monthStart),
        end_date: this.utilityService.formatDate(monthEnd),
        acivities_hours: this.mapToActivityArray(activityMap, allActivities),
      });
    }

    return { report, totals };
  }

  async getActivityReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get activity report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getActivityReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      const originalPeriodEnd = new Date(periodEnd);
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Activity', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Activity',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Activity';

      const entries: ActivityEntry[] = [];
      const allActivityNames = new Set<string>();
      let userList: any;

      {
        const categories = await this.prismaService.itemCategories.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
          select: {
            name: true,
          },
        });

        for (const category of categories) {
          const name = category.name?.trim();
          if (name) {
            allActivityNames.add(name);
          }
        }

        userList = await this.prismaService.userLists.findFirst({
          where: {
            userId,
            userRecSeq: REC_SEQ.DEFAULT_RECORD,
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        if (!userList) {
          userList = await this.prismaService.userLists.create({
            data: {
              userId,
              userRecSeq: REC_SEQ.DEFAULT_RECORD,
              listId: list.listId,
              listRecSeq: REC_SEQ.DEFAULT_RECORD,
              customName: 'Activity',
              ...ACTIVE_CONDITION,
            },
          });
        }

        if (userList) {
          const listItems = await this.prismaService.listItems.findMany({
            where: {
              listId: list.listId,
              listRecSeq: REC_SEQ.DEFAULT_RECORD,
              userListId: userList.userListId,
              userListRecSeq: REC_SEQ.DEFAULT_RECORD,
              ...ACTIVE_CONDITION,
            },
            include: {
              category: {
                select: {
                  name: true,
                },
              },
            },
          });

          for (const rawItem of listItems as unknown[]) {
            if (!rawItem || typeof rawItem !== 'object') {
              continue;
            }
            const itemRecord = rawItem as Record<string, unknown>;
            const categoryRaw = itemRecord['category'];
            let categoryName: string | null = null;
            if (
              categoryRaw &&
              typeof categoryRaw === 'object' &&
              !Array.isArray(categoryRaw)
            ) {
              const nameValue = (categoryRaw as Record<string, unknown>)[
                'name'
              ];
              if (typeof nameValue === 'string') {
                categoryName = nameValue;
              }
            }
            const titleValue = itemRecord['title'];
            const title = typeof titleValue === 'string' ? titleValue : null;
            const attrs = this.extractAttributes(
              itemRecord['attributes'] as Prisma.JsonValue | null,
            );
            const start =
              this.parseDateValue(attrs['startTime']) ??
              this.parseDateValue(attrs['start']) ??
              this.parseDateValue(attrs['startedAt']) ??
              this.parseDateValue(attrs['date']) ??
              this.parseDateValue(attrs['activityDate']);
            const end =
              this.parseDateValue(attrs['endTime']) ??
              this.parseDateValue(attrs['end']) ??
              this.parseDateValue(attrs['endedAt']) ??
              this.parseDateValue(attrs['finishTime']);

            const durationHours = this.computeDurationHours(attrs, start, end);

            if (!start || durationHours <= 0) {
              continue;
            }

            if (
              start.getTime() < periodStart.getTime() ||
              start.getTime() > periodEnd.getTime()
            ) {
              continue;
            }

            const activityName = this.resolveActivityName(
              categoryName,
              title,
              attrs,
            );
            allActivityNames.add(activityName);

            entries.push({
              activityName,
              start,
              hours: durationHours,
            });
          }
        }
      }

      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

      const activityMap = new Map<string, number>();
      for (const entry of entries) {
        activityMap.set(
          entry.activityName,
          (activityMap.get(entry.activityName) ?? 0) + entry.hours,
        );
      }

      const activities = this.mapToActivityArray(activityMap, allActivityNames);

      const reportResult =
        reportDto.type === 'monthly'
          ? this.buildWeeklyReport(
            entries,
            periodStart,
            originalPeriodEnd,
            allActivityNames,
          )
          : this.buildMonthlyReport(entries, reportDto.year, allActivityNames);

      let averageHours: number;
      if (reportDto.type === 'monthly') {
        const monthIndex = Math.min(
          11,
          Math.max(0, (reportDto.month ?? 1) - 1),
        );
        const lastDay = new Date(
          Date.UTC(reportDto.year, monthIndex + 1, 0),
        ).getUTCDate();
        averageHours = totalHours / lastDay;
      } else {
        averageHours = totalHours / 12;
      }

      let highestHoursSequence = 0;
      let highestSequenceLabel = '';

      if (reportResult.report && reportResult.report.length > 0) {
        for (const sequence of reportResult.report) {
          const sequenceTotal = sequence.acivities_hours.reduce(
            (sum, activity) => sum + activity.hours_spent,
            0,
          );
          if (sequenceTotal > highestHoursSequence) {
            highestHoursSequence = sequenceTotal;
            highestSequenceLabel = sequence.sequence_label;
          }
        }
      }

      response.data = {
        user_name: userName,
        list_type: listName,
        report_type: reportDto.type,
        total_hours: this.roundHours(totalHours),
        average_hours: this.roundHours(averageHours),
        highest_hours_of_sequence: this.roundHours(highestHoursSequence),
        highest_hours_of_sequence_label: highestSequenceLabel,
        activities,
        report: reportResult.report,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get activity report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getActivityReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get activity report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getActivityReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getListsAndItemsReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get lists and items report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getListsAndItemsReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      const userLists = await this.prismaService.userLists.findMany({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
        include: {
          list: {
            select: {
              listId: true,
              recSeq: true,
              name: true,
              listIcon: true,
            },
          },
        },
      });

      const reportArray = [];
      let totalItems = 0;

      for (const userList of userLists) {
        const list = userList.list;
        if (!list) continue;

        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        let itemCount = 0;
        const isTravelList = list.name === 'Travel';
        const uniqueDateCategorySet = new Set<string>();

        for (const item of listItems) {
          const attrs = this.extractAttributes(item.attributes);
          const start =
            this.parseDateValue(attrs['visitDate']) ??
            this.parseDateValue(attrs['startTime']) ??
            this.parseDateValue(attrs['start']) ??
            this.parseDateValue(attrs['startedAt']) ??
            this.parseDateValue(attrs['date']) ??
            this.parseDateValue(attrs['activityDate']) ??
            this.parseDateValue(attrs['startDate']);

          if (!start) {
            continue;
          }

          if (isTravelList) {
            const end = this.parseDateValue(attrs['endDate']) ?? start;
            const overlaps =
              periodStart.getTime() <= periodEnd.getTime() &&
              start.getTime() <= periodEnd.getTime() &&
              end.getTime() >= periodStart.getTime();

            if (overlaps) {
              itemCount++;
            }
          } else {
            if (
              start.getTime() < periodStart.getTime() ||
              start.getTime() > periodEnd.getTime()
            ) {
              continue;
            }

            const dateKey = this.utilityService.formatDate(start);
            const categoryKey = item.category?.name || 'Uncategorized';
            const clubbingKey = `${dateKey}|${categoryKey}`;

            if (!uniqueDateCategorySet.has(clubbingKey)) {
              uniqueDateCategorySet.add(clubbingKey);
              itemCount++;
            }
          }
        }

        reportArray.push({
          list_name: list.name,
          item_count: itemCount,
          custom_name: userList.customName,
        });

        totalItems += itemCount;
      }

      reportArray.sort((a, b) => b.item_count - a.item_count);

      response.data = {
        user_name: userName,
        list_type: 'Lists & Items',
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        total_items: totalItems,
        report: reportArray,
        userListId: null,
        listId: null,
        customName: null,
        predefinedList: null,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get lists and items report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getListsAndItemsReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get lists and items report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getListsAndItemsReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getTransportReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get transport report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getTransportReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Transport', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Transport',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Transport';

      const allTransportTypes = new Set<string>();

      {
        const categories = await this.prismaService.itemCategories.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
          select: {
            name: true,
          },
        });

        for (const category of categories) {
          const name = category.name?.trim();
          if (name) {
            allTransportTypes.add(name);
          }
        }
      }

      const transportMap = new Map<string, number>();

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            userListId: userList.userListId,
            ...ACTIVE_CONDITION,
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const item of listItems) {
          let startDate: Date | null = null;

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            startDate = this.parseDateTimeValue(
              attrs['startDate'],
              attrs['startTime'],
            );
          }

          if (!startDate) {
            continue;
          }

          if (
            startDate.getTime() < periodStart.getTime() ||
            startDate.getTime() > periodEnd.getTime()
          ) {
            continue;
          }

          let transportType = 'Other';

          if (item.category?.name) {
            transportType = item.category.name;
          } else if (item.title) {
            transportType = item.title;
          } else if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            const transportTypeAttr = attrs['transportType'] || attrs['type'];
            if (typeof transportTypeAttr === 'string') {
              transportType = transportTypeAttr;
            }
          }

          transportMap.set(
            transportType,
            (transportMap.get(transportType) ?? 0) + 1,
          );
        }
      }

      for (const transportType of allTransportTypes) {
        if (!transportMap.has(transportType)) {
          transportMap.set(transportType, 0);
        }
      }

      const reportArray = Array.from(transportMap.entries())
        .map(([transport_type, total_rides]) => ({
          transport_type,
          total_rides,
        }))
        .sort((a, b) => b.total_rides - a.total_rides);

      response.data = {
        user_name: userName,
        list_type: listName,
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        report: reportArray,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get transport report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getTransportReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get transport report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getTransportReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getTravelReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get travel report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getTravelReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Travel', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Travel',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Travel';

      const destinationMap = new Map<string, number>();
      const destinationDetails = new Map<
        string,
        { city: string; country: string }
      >();

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        for (const item of listItems) {
          let visitDate: Date | null = null;
          let endDate: Date | null = null;

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            visitDate =
              this.parseDateTimeValue(attrs['visitDate'], attrs['time']) ??
              this.parseDateTimeValue(attrs['date'], attrs['time']) ??
              this.parseDateTimeValue(attrs['startDate'], attrs['time']);
            endDate = this.parseDateTimeValue(attrs['endDate'], attrs['time']);
          }

          const tripStart = visitDate;
          const tripEnd = endDate || visitDate;

          if (!tripStart) {
            continue;
          }

          const overlaps =
            periodStart.getTime() <= periodEnd.getTime() &&
            tripStart.getTime() <= periodEnd.getTime() &&
            tripEnd.getTime() >= periodStart.getTime();

          if (!overlaps) {
            continue;
          }

          let city = '';
          let country = '';

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            city =
              typeof attrs['city'] === 'string' ? attrs['city'].trim() : '';
            country =
              typeof attrs['country'] === 'string'
                ? attrs['country'].trim()
                : '';

            if (!city || !country) {
              const address =
                typeof attrs['address'] === 'string'
                  ? attrs['address'].trim()
                  : '';
              if (address) {
                const parts = address.split(',').map((part) => part.trim());
                if (parts.length > 0) {
                  if (!city) {
                    city = parts[0];
                  }
                  if (!country && parts.length > 1) {
                    country = parts[parts.length - 1];
                  }
                }
              }
            }
          }

          if (!city || !country) {
            continue;
          }

          const key = `${city}|${country}`;
          destinationMap.set(key, (destinationMap.get(key) ?? 0) + 1);
          destinationDetails.set(key, { city, country });
        }
      }

      const totalDestinations = destinationDetails.size;

      const reportArray = Array.from(destinationMap.entries())
        .map(([key, visits]) => {
          const details = destinationDetails.get(key);
          return {
            city: details?.city || '',
            country: details?.country || '',
            visits,
          };
        })
        .sort((a, b) => b.visits - a.visits);

      response.data = {
        user_name: userName,
        list_type: listName,
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        total_destinations: totalDestinations,
        report: reportArray,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get travel report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getTravelReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get travel report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getTravelReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getHealthReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get health report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getHealthReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      const healthCategories = [
        'Steps',
        'Miles',
        'Sleep',
        'Heart Rate',
        // 'VO₂ Max',
      ];
      const report: Array<{
        category: string;
        value: number;
        daily_report?: Array<{ date: string; value: number }>;
        monthly_report?: Array<{ month: string; value: number }>;
      }> = [];

      const allListItems: any[] = [];

      for (const listName of ['Health']) {
        let list = await this.prismaService.lists.findFirst({
          where: { name: listName, ...ACTIVE_CONDITION },
        });

        if (!list) {
          list = await this.prismaService.lists.create({
            data: {
              name: listName,
              ...ACTIVE_CONDITION,
            },
          });
        }

        let userList = await this.prismaService.userLists.findFirst({
          where: {
            userId,
            userRecSeq: REC_SEQ.DEFAULT_RECORD,
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        if (!userList) {
          userList = await this.prismaService.userLists.create({
            data: {
              userId,
              userRecSeq: REC_SEQ.DEFAULT_RECORD,
              listId: list.listId,
              listRecSeq: REC_SEQ.DEFAULT_RECORD,
              customName: listName,
              ...ACTIVE_CONDITION,
            },
          });
        }

        if (userList) {
          const listItems = await this.prismaService.listItems.findMany({
            where: {
              listId: list.listId,
              listRecSeq: REC_SEQ.DEFAULT_RECORD,
              userListId: userList.userListId,
              userListRecSeq: REC_SEQ.DEFAULT_RECORD,
              ...ACTIVE_CONDITION,
            },
            include: {
              category: {
                select: {
                  name: true,
                },
                where: {
                  ...ACTIVE_CONDITION,
                },
              },
            },
          });

          allListItems.push(...listItems);
        }
      }

      for (const category of healthCategories) {
        if (reportDto.type === 'monthly') {
          const dailyData = this.buildHealthDailyReport(
            allListItems,
            category,
            periodStart,
            periodEnd,
          );
          report.push(dailyData);
        } else {
          const monthlyData = this.buildHealthMonthlyReport(
            allListItems,
            category,
            reportDto.year,
            periodStart,
            periodEnd,
          );
          report.push(monthlyData);
        }
      }

      const healthList = await this.prismaService.lists.findFirst({
        where: { name: 'Health', ...ACTIVE_CONDITION },
      });

      const healthUserList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: healthList?.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      response.data = {
        user_name: userName,
        list_type: 'Health',
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        report,
        userListId: healthUserList?.userListId,
        listId: healthList?.listId,
        customName: healthUserList?.customName,
        predefinedList: healthList?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get health report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getHealthReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get health report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getHealthReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  private buildHealthDailyReport(
    items: any[],
    category: string,
    periodStart: Date,
    periodEnd: Date,
  ): {
    category: string;
    value: number;
    daily_report: Array<{ date: string; value: number }>;
  } {
    // const isAveragingMetric = ['Heart Rate', 'VO₂ Max'].includes(category);
    const isAveragingMetric = ['Heart Rate'].includes(category);
    const dailyMap = new Map<string, { sum: number; count: number }>();
    let totalSum = 0;
    let totalCount = 0;

    for (const item of items) {
      let itemDate: Date | null = null;
      let itemValue: number = 0;

      if (item.attributes && typeof item.attributes === 'object') {
        const attrs = item.attributes as Record<string, unknown>;
        itemDate = this.parseDateTimeValue(attrs['date'], attrs['time']);

        switch (category) {
          case 'Steps':
            itemValue = this.toNumber(attrs['steps']) ?? 0;
            break;
          case 'Miles':
            itemValue =
              this.toNumber(attrs['miles']) ??
              this.toNumber(attrs['yards']) ??
              0;
            break;
          case 'Sleep':
            itemValue =
              this.parseDurationString(attrs['sleep'] as string) ??
              this.parseDurationString(attrs['duration'] as string) ??
              (this.toNumber(attrs['sleep'])
                ? this.roundToTwoDecimals(this.toNumber(attrs['sleep']) / 60)
                : null) ??
              (this.toNumber(attrs['duration'])
                ? this.roundToTwoDecimals(this.toNumber(attrs['duration']) / 60)
                : null) ??
              0;
            break;
          case 'Heart Rate':
            itemValue =
              this.toNumber(attrs['bpm']) ??
              this.toNumber(attrs['heartRate']) ??
              0;
            break;
        }
      }

      if (!itemDate || itemValue <= 0) {
        continue;
      }

      if (
        itemDate.getTime() < periodStart.getTime() ||
        itemDate.getTime() > periodEnd.getTime()
      ) {
        continue;
      }

      const dateStr = this.utilityService.formatDate(itemDate);
      const existing = dailyMap.get(dateStr) ?? { sum: 0, count: 0 };
      existing.sum += itemValue;
      existing.count += 1;
      dailyMap.set(dateStr, existing);

      totalSum += itemValue;
      totalCount += 1;
    }

    const dailyReport: Array<{ date: string; value: number }> = [];
    const currentDate = new Date(periodStart);
    currentDate.setUTCHours(0, 0, 0, 0);

    while (currentDate <= periodEnd) {
      const dateStr = this.utilityService.formatDate(currentDate);
      const entry = dailyMap.get(dateStr);
      const value = entry
        ? isAveragingMetric
          ? this.roundToTwoDecimals(entry.sum / entry.count)
          : this.roundToTwoDecimals(entry.sum)
        : 0;
      dailyReport.push({ date: dateStr, value });
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const totalValue = isAveragingMetric
      ? totalCount > 0
        ? this.roundToTwoDecimals(totalSum / totalCount)
        : 0
      : this.roundToTwoDecimals(totalSum);

    return {
      category,
      value: totalValue,
      daily_report: dailyReport,
    };
  }

  private buildHealthMonthlyReport(
    items: any[],
    category: string,
    year: number,
    periodStart: Date,
    periodEnd: Date,
  ): {
    category: string;
    value: number;
    monthly_report: Array<{ month: string; value: number }>;
  } {
    const isAveragingMetric = ['Heart Rate', 'VO₂ Max'].includes(category);
    const monthlyMap = new Map<number, { sum: number; count: number }>();
    let totalSum = 0;
    let totalCount = 0;

    for (const item of items) {
      let itemDate: Date | null = null;
      let itemValue: number = 0;

      if (item.attributes && typeof item.attributes === 'object') {
        const attrs = item.attributes as Record<string, unknown>;
        itemDate = this.parseDateTimeValue(attrs['date'], attrs['time']);

        switch (category) {
          case 'Steps':
            itemValue = this.toNumber(attrs['steps']) ?? 0;
            break;
          case 'Miles':
            itemValue =
              this.toNumber(attrs['miles']) ??
              this.toNumber(attrs['yards']) ??
              0;
            break;
          case 'Sleep':
            itemValue =
              this.parseDurationString(attrs['sleep'] as string) ??
              this.parseDurationString(attrs['duration'] as string) ??
              (this.toNumber(attrs['sleep'])
                ? this.roundToTwoDecimals(this.toNumber(attrs['sleep']) / 60)
                : null) ??
              (this.toNumber(attrs['duration'])
                ? this.roundToTwoDecimals(this.toNumber(attrs['duration']) / 60)
                : null) ??
              0;
            break;
          case 'Heart Rate':
            itemValue =
              this.toNumber(attrs['bpm']) ??
              this.toNumber(attrs['heartRate']) ??
              0;
            break;
        }
      }

      if (!itemDate || itemValue <= 0) {
        continue;
      }

      if (
        itemDate.getTime() < periodStart.getTime() ||
        itemDate.getTime() > periodEnd.getTime()
      ) {
        continue;
      }

      const monthIndex = itemDate.getUTCMonth();
      const existing = monthlyMap.get(monthIndex) ?? { sum: 0, count: 0 };
      existing.sum += itemValue;
      existing.count += 1;
      monthlyMap.set(monthIndex, existing);

      totalSum += itemValue;
      totalCount += 1;
    }

    const monthlyReport: Array<{ month: string; value: number }> = [];
    for (let month = 0; month < 12; month++) {
      const monthName = MONTH_NAMES[month];
      const entry = monthlyMap.get(month);
      const value = entry
        ? isAveragingMetric
          ? this.roundToTwoDecimals(entry.sum / entry.count)
          : this.roundToTwoDecimals(entry.sum)
        : 0;
      monthlyReport.push({ month: monthName, value });
    }

    const totalValue = isAveragingMetric
      ? totalCount > 0
        ? this.roundToTwoDecimals(totalSum / totalCount)
        : 0
      : this.roundToTwoDecimals(totalSum);

    return {
      category,
      value: totalValue,
      monthly_report: monthlyReport,
    };
  }

  async getFoodReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get food report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getFoodReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Food', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Food',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Food';

      const foodCategories = [
        { type: 'Coffee Shops', label: 'Coffee' },
        { type: 'Breakfast', label: "B'fast" },
        { type: 'Lunch', label: 'Lunch' },
        { type: 'Dinner', label: 'Dinner' },
        { type: 'Drinks', label: 'Drinks' },
        { type: 'Sweet Treat', label: 'Treats' },
      ];

      const categoryMap = new Map<string, number>();
      for (const cat of foodCategories) {
        categoryMap.set(cat.type, 0);
      }

      const reportItems: any[] = [];
      const foodSpotVisits = new Map<
        string,
        { dates: string[]; count: number; category: string }
      >();

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            userListId: userList.userListId,
            ...ACTIVE_CONDITION,
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const item of listItems) {
          let itemDate: Date | null = null;

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            itemDate = this.parseDateTimeValue(attrs['date'], attrs['time']);
          }

          if (!itemDate) {
            continue;
          }

          if (
            itemDate.getTime() < periodStart.getTime() ||
            itemDate.getTime() > periodEnd.getTime()
          ) {
            continue;
          }

          const foodSpotName = item.title || 'Unknown';
          const categoryName = item.category?.name || 'Other';

          if (categoryMap.has(categoryName)) {
            categoryMap.set(
              categoryName,
              (categoryMap.get(categoryName) ?? 0) + 1,
            );
          }

          if (reportDto.type === 'monthly') {
            const dateStr = this.utilityService.formatDate(itemDate);
            reportItems.push({
              food_spot: foodSpotName,
              date: dateStr,
              category: categoryName,
            });
          } else {
            if (!foodSpotVisits.has(foodSpotName)) {
              foodSpotVisits.set(foodSpotName, {
                dates: [],
                count: 0,
                category: categoryName,
              });
            }
            const visit = foodSpotVisits.get(foodSpotName);
            visit.count += 1;
            visit.dates.push(this.utilityService.formatDate(itemDate));
          }
        }
      }

      const categories = foodCategories.map((cat) => ({
        category_type: cat.type,
        category_label: cat.label,
        total_food_spots: categoryMap.get(cat.type) ?? 0,
      }));

      let totalFoodSpots = 0;
      if (reportDto.type === 'yearly') {
        const yearlyReport: any[] = [];
        for (const [foodSpot, visitData] of foodSpotVisits.entries()) {
          for (const date of visitData.dates) {
            yearlyReport.push({
              food_spot: foodSpot,
              date: date,
              category: visitData.category,
            });
          }
        }
        totalFoodSpots = yearlyReport.length;
        response.data = {
          user_name: userName,
          list_type: listName,
          report_type: 'Yearly',
          total_food_spots: totalFoodSpots,
          categories,
          report: yearlyReport,
          userListId: userList?.userListId,
          listId: list?.listId,
          customName: userList?.customName,
          predefinedList: list?.name,
        };
      } else {
        totalFoodSpots = reportItems.length;
        response.data = {
          user_name: userName,
          list_type: listName,
          report_type: 'Monthly',
          total_food_spots: totalFoodSpots,
          categories,
          report: reportItems,
          userListId: userList?.userListId,
          listId: list?.listId,
          customName: userList?.customName,
          predefinedList: list?.name,
        };
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get food report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getFoodReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get food report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getFoodReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getPlacesVisitedReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get places visited report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getPlacesVisitedReport,
      },
      input: reportDto,
    });

    try {
      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Places Visited', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Places Visited',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Places Visited';

      const placesCategories = [
        { type: 'Grocery Stores', label: 'grocery' },
        { type: 'Online Stores', label: 'online stores' },
        { type: 'Parks', label: 'parks' },
        { type: 'Museums', label: 'museums' },
        { type: 'Friends Homes', label: "friends'" },
        { type: 'Retail Stores', label: 'retail stores' },
      ];

      const categoryMap = new Map<string, number>();
      for (const cat of placesCategories) {
        categoryMap.set(cat.type, 0);
      }

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            userListId: userList.userListId,
            ...ACTIVE_CONDITION,
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const item of listItems) {
          const attrs = this.extractAttributes(item.attributes);
          const itemDate = this.parseDateTimeValue(attrs.date, attrs.time);

          if (
            itemDate &&
            itemDate.getTime() >= periodStart.getTime() &&
            itemDate.getTime() <= periodEnd.getTime()
          ) {
            const categoryName = item.category?.name || 'Other';

            if (categoryMap.has(categoryName)) {
              categoryMap.set(
                categoryName,
                (categoryMap.get(categoryName) ?? 0) + 1,
              );
            }
          }
        }
      }

      const reportArray = placesCategories.map((cat) => ({
        category_type: cat.type,
        category_label: cat.label,
        value: categoryMap.get(cat.type) ?? 0,
      }));

      response.data = {
        user_name: userName,
        list_type: listName,
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        report: reportArray,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get places visited report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getPlacesVisitedReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get places visited report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getPlacesVisitedReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getEventsReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get events report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getEventsReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Events', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Events',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Events';

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      let totalEvents = 0;
      const categorySummary: Map<string, number> = new Map();
      const allCategories: Set<string> = new Set();
      const eventsByDate: Map<string, any[]> = new Map();
      const eventsByMonth: Map<number, any[]> = new Map();

      const listCategories = await this.prismaService.itemCategories.findMany({
        where: {
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
        select: { name: true },
      });

      for (const cat of listCategories) {
        if (cat.name) {
          allCategories.add(cat.name);
        }
      }

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            userListId: userList.userListId,
            ...ACTIVE_CONDITION,
          },
          include: {
            category: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const rawItem of listItems as unknown[]) {
          if (!rawItem || typeof rawItem !== 'object') {
            continue;
          }
          const itemRecord = rawItem as Record<string, unknown>;
          const categoryRaw = itemRecord['category'];
          let categoryName: string | null = null;
          if (
            categoryRaw &&
            typeof categoryRaw === 'object' &&
            !Array.isArray(categoryRaw)
          ) {
            const nameValue = (categoryRaw as Record<string, unknown>)['name'];
            if (typeof nameValue === 'string') {
              categoryName = nameValue;
            }
          }

          const category = categoryName || 'Other';

          const titleValue = itemRecord['title'];
          const attrs = this.extractAttributes(
            itemRecord['attributes'] as Prisma.JsonValue | null,
          );
          const eventName = attrs['eventName']
            ? attrs['eventName']
            : typeof titleValue === 'string'
              ? titleValue
              : null;

          const eventDate =
            this.parseDateTimeValue(attrs['startDate'], attrs['startTime']) ??
            this.parseDateValue(attrs['eventDate']) ??
            this.parseDateValue(attrs['date']) ??
            this.parseDateValue(attrs['start']);

          if (!eventDate || !eventName) {
            continue;
          }

          if (
            eventDate.getTime() < periodStart.getTime() ||
            eventDate.getTime() > periodEnd.getTime()
          ) {
            continue;
          }

          categorySummary.set(
            category,
            (categorySummary.get(category) ?? 0) + 1,
          );
          totalEvents++;

          const dateStr = this.utilityService.formatDate(eventDate);

          if (reportDto.type === 'monthly') {
            const eventObj = {
              event_category: category,
              event_name: eventName,
            };
            if (!eventsByDate.has(dateStr)) {
              eventsByDate.set(dateStr, []);
            }
            eventsByDate.get(dateStr).push(eventObj);
          } else {
            const eventObj = {
              event_category: category,
              event_name: eventName,
              event_date: dateStr,
            };
            const monthIdx = eventDate.getUTCMonth();
            if (!eventsByMonth.has(monthIdx)) {
              eventsByMonth.set(monthIdx, []);
            }
            eventsByMonth.get(monthIdx).push(eventObj);
          }
        }
      }

      const baseCategoriesSummary = Array.from(allCategories)
        .map((label) => ({
          category_label: label,
          total_events: categorySummary.get(label) ?? 0,
        }))
        .sort((a, b) => {
          if (b.total_events === a.total_events) {
            return a.category_label.localeCompare(b.category_label);
          }
          return b.total_events - a.total_events;
        });

      const report: any[] = [];

      if (reportDto.type === 'monthly') {
        const monthIndex = Math.min(
          11,
          Math.max(0, (reportDto.month ?? 1) - 1),
        );
        const lastDay = new Date(
          Date.UTC(reportDto.year, monthIndex + 1, 0),
        ).getUTCDate();

        const monthStart = `${reportDto.year.toString().padStart(4, '0')}-${(
          monthIndex + 1
        )
          .toString()
          .padStart(2, '0')}-01`;
        const monthEnd = `${reportDto.year.toString().padStart(4, '0')}-${(
          monthIndex + 1
        )
          .toString()
          .padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        for (let day = 1; day <= lastDay; day++) {
          const dateStr = `${reportDto.year.toString().padStart(4, '0')}-${(
            monthIndex + 1
          )
            .toString()
            .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

          report.push({
            date: dateStr,
            events_list: eventsByDate.get(dateStr) || [],
          });
        }

        const daysWithoutEvents = lastDay - eventsByDate.size;
        const categories_summary = [...baseCategoriesSummary];
        // if (daysWithoutEvents > 0) {
        categories_summary.push({
          category_label: 'No Event',
          total_events: daysWithoutEvents,
        });
        categories_summary.sort((a, b) => {
          if (b.total_events === a.total_events) {
            return a.category_label.localeCompare(b.category_label);
          }
          return b.total_events - a.total_events;
        });
        // }

        const datesRange = [monthStart, monthEnd];

        response.data = {
          user_name: userName,
          list_type: listName,
          report_type: 'Monthly',
          total_events: totalEvents,
          dates_range: datesRange,
          categories_summary,
          report,
          userListId: userList?.userListId || null,
          listId: list?.listId,
          customName: userList?.customName || null,
          predefinedList: list?.name,
        };
      } else {
        for (let month = 0; month < 12; month++) {
          report.push({
            month: MONTH_NAMES[month],
            events_list: eventsByMonth.get(month) || [],
          });
        }

        const isLeapYear =
          (reportDto.year % 4 === 0 && reportDto.year % 100 !== 0) ||
          reportDto.year % 400 === 0;
        const totalDaysInYear = isLeapYear ? 366 : 365;
        let daysWithEvents = 0;
        for (const month of eventsByMonth.values()) {
          const dates = new Set<string>();
          for (const event of month) {
            if (event.event_date) {
              dates.add(event.event_date);
            }
          }
          daysWithEvents += dates.size;
        }
        const daysWithoutEvents = totalDaysInYear - daysWithEvents;

        const categories_summary = [...baseCategoriesSummary];
        if (daysWithoutEvents > 0) {
          categories_summary.push({
            category_label: 'No Event',
            total_events: daysWithoutEvents,
          });
          categories_summary.sort((a, b) => {
            if (b.total_events === a.total_events) {
              return a.category_label.localeCompare(b.category_label);
            }
            return b.total_events - a.total_events;
          });
        }

        response.data = {
          user_name: userName,
          list_type: listName,
          report_type: 'Yearly',
          total_events: totalEvents,
          categories_summary,
          report,
          userListId: userList?.userListId || null,
          listId: list?.listId,
          customName: userList?.customName || null,
          predefinedList: list?.name,
        };
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get events report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getEventsReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get events report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getEventsReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getBooksReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get books report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getBooksReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Books', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Books',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Books';

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      let totalBooks = 0;
      let totalPages = 0;
      const reportItems: any[] = [];
      const booksByMonth: Map<number, any[]> = new Map();

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        for (const item of listItems) {
          let itemDate: Date | null = null;
          let pages = 0;

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            itemDate =
              this.parseDateTimeValue(attrs['readDate'], attrs['time']) ??
              this.parseDateTimeValue(attrs['date'], attrs['time']) ??
              this.parseDateTimeValue(attrs['completionDate'], attrs['time']);

            pages =
              this.toNumber(attrs['pages']) ??
              this.toNumber(attrs['totalPages']) ??
              this.toNumber(attrs['pageCount']) ??
              0;
          }

          if (!itemDate) {
            continue;
          }

          if (
            itemDate.getTime() < periodStart.getTime() ||
            itemDate.getTime() > periodEnd.getTime()
          ) {
            continue;
          }

          const bookName = item.title || 'Unknown';
          totalBooks++;
          totalPages += pages;

          if (reportDto.type === 'monthly') {
            const dateStr = this.utilityService.formatDate(itemDate);
            reportItems.push({
              book_name: bookName,
              pages,
              date: dateStr,
            });
          } else {
            const monthIdx = itemDate.getUTCMonth();
            if (!booksByMonth.has(monthIdx)) {
              booksByMonth.set(monthIdx, []);
            }
            booksByMonth.get(monthIdx).push({
              book_name: bookName,
              pages,
            });
          }
        }
      }

      if (reportDto.type === 'monthly') {
        response.data = {
          user_name: userName,
          list_type: listName,
          userListId: userList?.userListId,
          listId: list?.listId,
          customName: userList?.customName,
          predefinedList: list?.name,
          report_type: 'Monthly',
          total_books: totalBooks,
          total_pages: totalPages,
          report: reportItems,
        };
      } else {
        const monthlyReport: any[] = [];

        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(Date.UTC(reportDto.year, month, 1));
          if (monthStart.getTime() > periodEnd.getTime()) {
            break;
          }

          monthlyReport.push({
            month: MONTH_NAMES[month],
            books_data: booksByMonth.get(month) || [],
          });
        }

        response.data = {
          user_name: userName,
          list_type: listName,
          userListId: userList?.userListId,
          listId: list?.listId,
          customName: userList?.customName,
          predefinedList: list?.name,
          report_type: 'Yearly',
          total_books: totalBooks,
          total_pages: totalPages,
          monthly_report: monthlyReport,
        };
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get books report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getBooksReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get books report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getBooksReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.ERROR_OCCURRED,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getMusicReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get music report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getMusicReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Music', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Music',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Music';

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      const songMap = new Map<
        string,
        { song_name: string; artist_name: string; count: number }
      >();
      const artistMap = new Map<string, number>();
      const albumMap = new Map<string, number>();
      let latestDate: Date | null = null;
      let latestDateSongs: Array<{
        song_name: string;
        artist_name: string;
        key: string;
      }> = [];

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        for (const item of listItems) {
          if (!item.attributes) {
            continue;
          }

          const attributeEntries: unknown[] = Array.isArray(item.attributes)
            ? item.attributes
            : [item.attributes];

          for (const entry of attributeEntries) {
            if (typeof entry !== 'object' || entry === null) {
              continue;
            }

            const attrs = entry as Record<string, unknown>;

            let itemDate: Date | null = null;

            if (typeof attrs['date'] === 'string') {
              itemDate = this.parseDateValue(attrs['date']);
            }

            if (!itemDate) {
              itemDate =
                this.parseDateTimeValue(attrs['startTime'], attrs['time']) ??
                this.parseDateTimeValue(attrs['playedAt'], attrs['time']) ??
                this.parseDateTimeValue(attrs['addedAt'], attrs['time']);
            }

            if (!itemDate) {
              continue;
            }

            if (
              itemDate.getTime() < periodStart.getTime() ||
              itemDate.getTime() > periodEnd.getTime()
            ) {
              continue;
            }

            if (!latestDate || itemDate.getTime() > latestDate.getTime()) {
              latestDate = itemDate;
              latestDateSongs = [];
            }

            const rawSongs = attrs['songs'];
            const songs: unknown[] = Array.isArray(rawSongs)
              ? rawSongs
              : typeof rawSongs === 'object' && rawSongs !== null
                ? [rawSongs]
                : [];

            if (songs.length === 0) {
              const songName =
                (typeof attrs?.['trackName'] === 'string'
                  ? attrs['trackName']
                  : item.title) || 'Unknown';
              const artistName =
                (typeof attrs?.['artistName'] === 'string'
                  ? attrs['artistName']
                  : 'Unknown Artist') || 'Unknown Artist';
              const albumName =
                (typeof attrs?.['albumName'] === 'string'
                  ? attrs['albumName']
                  : 'Unknown Album') || 'Unknown Album';

              const external = attrs?.['external'] as Record<
                string,
                unknown
              > | null;
              const trackId =
                typeof external?.['id'] === 'string' ? external['id'] : null;

              const key = trackId || `${songName}|${artistName}`;
              if (songMap.has(key)) {
                const existing = songMap.get(key);
                existing.count += 1;
              } else {
                songMap.set(key, {
                  song_name: songName,
                  artist_name: artistName,
                  count: 1,
                });
              }

              if (itemDate.getTime() === latestDate?.getTime()) {
                latestDateSongs.push({
                  song_name: songName,
                  artist_name: artistName,
                  key,
                });
              }

              artistMap.set(artistName, (artistMap.get(artistName) ?? 0) + 1);
              albumMap.set(albumName, (albumMap.get(albumName) ?? 0) + 1);
            } else {
              for (const song of songs) {
                if (typeof song !== 'object' || song === null) {
                  continue;
                }

                const songObj = song as Record<string, unknown>;
                const songName =
                  typeof songObj['song'] === 'string'
                    ? songObj['song']
                    : 'Unknown';
                const artistName =
                  typeof songObj['artist'] === 'string'
                    ? songObj['artist']
                    : 'Unknown Artist';
                const albumName =
                  typeof songObj['album'] === 'string'
                    ? songObj['album']
                    : 'Unknown Album';

                const external = attrs?.['external'] as Record<
                  string,
                  unknown
                > | null;
                const trackId =
                  typeof songObj['trackId'] === 'string'
                    ? songObj['trackId']
                    : typeof external?.['id'] === 'string'
                      ? external['id']
                      : null;

                const key = trackId || `${songName}|${artistName}`;
                if (songMap.has(key)) {
                  const existing = songMap.get(key);
                  existing.count += 1;
                } else {
                  songMap.set(key, {
                    song_name: songName,
                    artist_name: artistName,
                    count: 1,
                  });
                }

                if (itemDate.getTime() === latestDate?.getTime()) {
                  latestDateSongs.push({
                    song_name: songName,
                    artist_name: artistName,
                    key,
                  });
                }

                artistMap.set(artistName, (artistMap.get(artistName) ?? 0) + 1);
                albumMap.set(albumName, (albumMap.get(albumName) ?? 0) + 1);
              }
            }
          }
        }
      }

      const uniqueLatestDateSongs = Array.from(
        new Map(latestDateSongs.map((song) => [song.key, song])).values(),
      );

      const songsReport = uniqueLatestDateSongs.slice(0, 5).map((song) => {
        const songData = songMap.get(song.key);
        return {
          song_name: song.song_name,
          artist_name: song.artist_name,
          play_count: songData?.count ?? 1,
        };
      });

      const artistsReport = Array.from(artistMap.entries())
        .map(([artist_name, count]) => ({ artist_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ artist_name }) => ({ artist_name }));

      const albumsReport = Array.from(albumMap.entries())
        .map(([album_name, count]) => ({ album_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ album_name }) => ({ album_name }));

      const totalSongsWithDuplicates = Array.from(songMap.values()).reduce(
        (sum, song) => sum + song.count,
        0,
      );

      response.data = {
        user_name: userName,
        list_type: listName,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        total_songs: totalSongsWithDuplicates,
        total_artists: artistMap.size,
        total_albums: albumMap.size,
        songs_report: songsReport,
        artists_report: artistsReport,
        albums_report: albumsReport,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get music report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getMusicReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get music report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getMusicReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async getFriendsReport(
    reportDto: ReportRequestDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'get friends report',
      data: {
        service: VisualizationsService.name,
        method: MethodNames.getFriendsReport,
      },
      input: reportDto,
    });

    try {
      const monthIndex =
        reportDto.type === 'monthly'
          ? Math.min(11, Math.max(0, (reportDto.month ?? 1) - 1))
          : 0;
      const periodStart =
        reportDto.type === 'monthly'
          ? new Date(Date.UTC(reportDto.year, monthIndex, 1))
          : new Date(Date.UTC(reportDto.year, 0, 1));
      let periodEnd =
        reportDto.type === 'monthly'
          ? new Date(
            Date.UTC(reportDto.year, monthIndex + 1, 0, 23, 59, 59, 999),
          )
          : new Date(Date.UTC(reportDto.year, 11, 31, 23, 59, 59, 999));
      periodEnd = this.capPeriodEndToToday(periodEnd);

      const userRecord = await this.prismaService.users.findFirst({
        where: { userId, ...ACTIVE_CONDITION },
        select: {
          firstName: true,
          lastName: true,
          username: true,
          email: true,
        },
      });

      const firstName = userRecord?.firstName?.trim();
      const lastName = userRecord?.lastName?.trim();
      const username = userRecord?.username?.trim();
      const combinedName = [firstName, lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const userName =
        username || combinedName || firstName || userRecord?.email || 'User';

      let list = await this.prismaService.lists.findFirst({
        where: { name: 'Friends', ...ACTIVE_CONDITION },
      });

      if (!list) {
        list = await this.prismaService.lists.create({
          data: {
            name: 'Friends',
            ...ACTIVE_CONDITION,
          },
        });
      }

      const listName = list?.name ?? 'Friends';

      const friendsMap = new Map<string, number>();

      const userList = await this.prismaService.userLists.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (userList) {
        const listItems = await this.prismaService.listItems.findMany({
          where: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        for (const item of listItems) {
          let startDate: Date | null = null;

          if (item.attributes && typeof item.attributes === 'object') {
            const attrs = item.attributes as Record<string, unknown>;
            startDate = this.parseDateValue(attrs['startDate']);
          }

          if (!startDate) {
            continue;
          }

          if (
            startDate.getTime() < periodStart.getTime() ||
            startDate.getTime() > periodEnd.getTime()
          ) {
            continue;
          }

          const friendName = item.title || 'Unknown';

          friendsMap.set(friendName, (friendsMap.get(friendName) ?? 0) + 1);
        }
      }

      const reportArray = Array.from(friendsMap.entries())
        .map(([friend_name, connections]) => ({
          friend_name,
          connections,
        }))
        .sort((a, b) => b.connections - a.connections);

      response.data = {
        user_name: userName,
        list_type: listName,
        report_type: reportDto.type === 'monthly' ? 'Monthly' : 'Yearly',
        total_unique_friends: friendsMap.size,
        report: reportArray,
        userListId: userList?.userListId,
        listId: list?.listId,
        customName: userList?.customName,
        predefinedList: list?.name,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'get friends report successfully',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getFriendsReport,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'get friends report failed',
        data: {
          service: VisualizationsService.name,
          method: MethodNames.getFriendsReport,
        },
        error:
          error instanceof Error
            ? { message: error.message }
            : RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      });
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR,
      };
    }
  }
}
