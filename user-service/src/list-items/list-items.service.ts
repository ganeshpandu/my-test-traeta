import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import * as moment from 'moment';
import { UtilityService } from '../utility/utility.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { UserListsService } from 'src/user-lists/user-lists.service';
import {
  ACTIVE_CONDITION,
  DB_NAME,
  LogType,
  MethodNames,
  REC_SEQ,
  REC_STATUS,
  RESPONSE_STATUS,
  Response,
  TABLE_NAMES,
  Metadata,
  UNITS,
  ListNames,
  LIST_ORDER,
} from '../../constants';
import {
  CreateListItemDto,
  ListItemFilterDto,
  UpdateListItemDto,
  ListItemsByDateFilterDto,
  DeleteListItemDto,
} from './dto/list-items.dto';
import { Prisma } from '@prisma/client';

interface ProcessedImage {
  url: string;
  originalUrl: string;
  [key: string]: any; // To allow for additional properties from the original image object
}

interface ListItemAttributes {
  images?: Array<string | ProcessedImage>;
}

@Injectable()
export class ListItemsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
    private readonly integrationsService: IntegrationsService,
    private readonly userListService: UserListsService,
  ) {}

  private cleanListItem(item: any): any {
    const isHealth = item?.list?.name === ListNames.HEALTH;
    const fieldsToRemove = [
      'recSeq',
      'recStatus',
      'listRecSeq',
      'categoryRecSeq',
      'userListRecSeq',
      'notes',
      'starred',
      // Keep attributeDataType for Health list
      ...(isHealth ? ([] as string[]) : ['attributeDataType']),
      'unit',
      'dataStatus',
      'createdBy',
      'createdOn',
      'modifiedOn',
      'modifiedBy',
    ];

    const cleaned = { ...item };
    fieldsToRemove.forEach((field) => {
      delete cleaned[field];
    });

    return cleaned;
  }

  async create(
    createDto: CreateListItemDto,
    userId: string,
    images?: Express.Multer.File[],
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.CREATED, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'create list item',
      data: { service: ListItemsService.name, method: MethodNames.create },
      input: createDto,
    });

    try {
      const existingRecord = await this.prismaService.listItems.findFirst({
        where: {
          listId: createDto.listId,
          userListId: createDto.userListId,
          categoryId: createDto.categoryId,
          attributes:
            createDto.attributes === null
              ? { equals: Prisma.JsonNull }
              : createDto.attributes === undefined
                ? undefined
                : { equals: createDto.attributes },
          ...ACTIVE_CONDITION,
          isCustom:
            createDto.isCustom !== undefined
              ? Boolean(createDto.isCustom)
              : false,
        },
      });

      if (existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'create list item failed - already exists',
          data: { service: ListItemsService.name, method: MethodNames.create },
          input: createDto,
        });
        return {
          status: HttpStatus.BAD_REQUEST,
          data: RESPONSE_STATUS.ERROR.ALREADY_EXISTS,
        };
      }

      // Helper function to parse JSON fields
      const parseJsonField = (
        field: any,
        fieldName: string,
      ): Record<string, any> | null => {
        if (!field) return null;
        try {
          return typeof field === 'string' ? JSON.parse(field) : { ...field };
        } catch (e) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Error parsing ${fieldName}`,
            error: e,
            [fieldName]: field,
          });
          return null;
        }
      };

      const attributes =
        parseJsonField(createDto.attributes, 'attributes') || {};
      const attributeDataType = parseJsonField(
        createDto.attributeDataType,
        'attributeDataType',
      );
      const unit = parseJsonField(createDto.unit, 'unit');

      if (images && images.length > 0) {
        const imageUrls = await Promise.all(
          images.map(async (image) => {
            return this.utilityService.uploadFile(image);
          }),
        ).then((urls) => urls.filter((url): url is string => Boolean(url)));

        if (imageUrls.length > 0) {
          if (!Array.isArray(attributes.images)) {
            attributes.images = [];
          }
          attributes.images = [...attributes.images, ...imageUrls];
        }
      }

      // Create a new object without the images property to exclude it from Prisma
      const { images: _, ...createData } = createDto;

      // Update the necessary fields
      createData.attributes = attributes;
      createData.attributeDataType = attributeDataType;
      createData.unit = unit;

      const data: Prisma.ListItemsUncheckedCreateInput = {
        ...createData,
        categoryId: createData.categoryId === '' ? null : createData.categoryId,
        starred:
          createData.starred !== undefined
            ? Boolean(createData.starred)
            : false,
        isCustom:
          createData.isCustom !== undefined
            ? Boolean(createData.isCustom)
            : false,
        attributes:
          createData.attributes === null
            ? Prisma.JsonNull
            : (createData.attributes as Prisma.JsonValue),
        attributeDataType:
          createData.attributeDataType === null
            ? Prisma.JsonNull
            : (createData.attributeDataType as Prisma.JsonValue),
        unit:
          createData.unit === null
            ? Prisma.JsonNull
            : (createData.unit as Prisma.JsonValue),
        ...ACTIVE_CONDITION,
        createdBy: userId,
      };

      const result = await this.prismaService.listItems.create({ data });

      response.data = result;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'create list item successfully',
        data: { service: ListItemsService.name, method: MethodNames.create },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'create list item failed',
        data: { service: ListItemsService.name, method: MethodNames.create },
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

  async findAll(
    filterDto: ListItemFilterDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    const metadata: Metadata = { pageNumber: 1, limit: 1, totalCount: 0 };

    this.loggerInstance.logger(LogType.INFO, {
      message: 'find all list items',
      data: { service: ListItemsService.name, method: MethodNames.findAll },
      input: filterDto,
    });

    try {
      const { pageNumber, limit, search } = filterDto;
      const skip = pageNumber && limit ? (pageNumber - 1) * limit : 0;

      const filterConditions = this.utilityService.buildFilter(filterDto, [
        'pageNumber',
        'limit',
        'search',
        'startTime',
        'endTime',
        'timezoneOffsetMinutes',
        'timezone',
      ]);

      let searchCondition = {};
      if (search && search.trim().length > 0) {
        searchCondition = {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        };
      }

      const startTimeCondition = filterDto.startTime
        ? {
            createdAt: {
              gte: filterDto.startTime,
            },
          }
        : {};
      const endTimeCondition = filterDto.endTime
        ? {
            createdAt: {
              lte: filterDto.endTime,
            },
          }
        : {};

      const whereCondition = {
        AND: [
          filterConditions,
          searchCondition,
          startTimeCondition,
          endTimeCondition,
          ACTIVE_CONDITION,
        ],
      };

      const [listItems, totalCount] = await Promise.all([
        this.prismaService.listItems.findMany({
          where: whereCondition,
          include: {
            userList: {
              select: {
                customName: true,
              },
            },
            list: {
              select: {
                name: true,
              },
            },
            category: {
              select: {
                name: true,
              },
            },
          },
          skip,
          take: limit,
        }),
        this.prismaService.listItems.count({ where: whereCondition }),
      ]);

      metadata.totalCount = totalCount;

      let listCategories: Array<{ name: string | null }> = [];
      if (filterDto.listId) {
        listCategories = await this.prismaService.itemCategories.findMany({
          where: {
            listId: filterDto.listId,
            ...ACTIVE_CONDITION,
          },
          select: {
            name: true,
          },
        });
      }

      let itemsForOutput: any[] = listItems as any[];
      const healthList = await this.prismaService.lists.findFirst({
        where: {
          name: ListNames.HEALTH,
          ...ACTIVE_CONDITION,
        },
        select: {
          listId: true,
        },
      });

      const cleanAttributes = (item: any) => {
        const categoryName = item?.category?.name || '';
        const attrs = { ...(item.attributes || {}) };

        // Always keep date and external
        const cleaned: any = {
          date: attrs.date,
          ...(attrs.external && { external: attrs.external }),
        };

        // Include clubbedItemIds if present (aggregate metadata)
        if (Array.isArray(attrs.clubbedItemIds)) {
          cleaned.clubbedItemIds = attrs.clubbedItemIds;
        }

        if (attrs.distance != null) {
          cleaned.distance = Number(attrs.distance).toFixed(2);
        }

        // Add category-specific fields
        switch (categoryName) {
          case 'Steps':
            cleaned.steps = attrs.steps;
            break;
          case 'Miles':
            cleaned.miles = Number(attrs.miles).toFixed(2);
            break;
          case 'Heart Rate':
            cleaned.bpm = attrs.bpm;
            break;
          case 'VO2 Max':
            cleaned.vo2max = attrs.vo2max;
            break;
          case 'Sleep':
            cleaned.duration = attrs.duration;
            break;
        }

        return cleaned;
      };

      if (filterDto.listId === healthList?.listId) {
        const map = new Map<string, any>();
        const sumFields = UNITS;

        const formatDate = (d: any) => {
          if (!d) return undefined as unknown as string;
          try {
            return this.utilityService.formatDate(String(d));
          } catch {
            return String(d);
          }
        };

        const parseDurationToMinutes = (v: any): number => {
          if (!v && v !== 0) return 0;
          if (typeof v === 'number') return v;
          const s = String(v).trim();
          let total = 0;
          const h = s.match(/(\d+)\s*h/i);
          const m = s.match(/(\d+)\s*m/i);
          const sec = s.match(/(\d+)\s*s/i);
          if (h) total += parseInt(h[1], 10) * 60;
          if (m) total += parseInt(m[1], 10);
          if (sec) total += Math.round(parseInt(sec[1], 10) / 60);
          if (total === 0) {
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
          }
          return total;
        };

        const formatMinutes = (mins: number): string => {
          const m = Math.max(0, Math.round(mins));
          const h = Math.floor(m / 60);
          const rem = m % 60;
          if (h > 0 && rem > 0) return `${h}h ${rem}m`;
          if (h > 0) return `${h}h`;
          return `${rem}m`;
        };

        // Separate custom items; only aggregate non-custom
        const customItems = (listItems as any[]).filter((it) =>
          Boolean(it?.isCustom),
        );
        for (const item of listItems as any[]) {
          if (item?.isCustom) {
            // Skip custom items from aggregation
            continue;
          }
          const categoryName = item?.category?.name || '';
          const attr = (item?.attributes || {}) as Record<string, any>;
          const rawDate = attr.date || item.date || item.createdAt;
          const date = formatDate(rawDate);
          const key = `${categoryName}|${date}`;

          if (!map.has(key)) {
            map.set(key, {
              ...item,
              title: item.title,
              // attributes: { ...(item.attributes || {}), date },
              attributes: { date, clubbedItemIds: [], _aggregate: true },
            });
          }

          const agg = map.get(key);
          const a = (agg.attributes ||= {});
          // Track which items are clubbed into this aggregate
          if (item?.listItemId) {
            a.clubbedItemIds = Array.isArray(a.clubbedItemIds)
              ? a.clubbedItemIds
              : [];
            if (!a.clubbedItemIds.includes(item.listItemId)) {
              a.clubbedItemIds.push(item.listItemId);
            }
          }
          // sum known numeric fields if present
          for (const f of sumFields) {
            if (categoryName === 'Sleep' && f === 'duration') {
              const incMin = parseDurationToMinutes(
                attr['sleep'] ?? attr['duration'],
              );
              a._durationMin = Number(a._durationMin ?? 0) + incMin;
              a.duration = formatMinutes(a._durationMin);
              continue;
            }
            const curr = Number(a[f] ?? 0);
            const inc = Number(attr[f] ?? 0);
            if (!Number.isNaN(curr + inc)) a[f] = curr + inc;
            // Track counts for average-based fields
            if (
              (f === 'bpm' || f === 'vo2max') &&
              attr[f] != null &&
              !Number.isNaN(Number(attr[f]))
            ) {
              const countKey = f === 'bpm' ? '_bpmCount' : '_vo2Count';
              a[countKey] = Number(a[countKey] ?? 0) + 1;
            }
          }
          // Keep external/provider deterministic per day aggregate if available
          if (attr?.external && !agg.attributes?.external) {
            a.external = {
              ...attr.external,
              id: `${attr.external.id || 'health'}_${categoryName}_${date}`,
              type: `${attr.external.type || 'aggregate'}`,
            };
          }
          // Ensure date is set
          a.date = date;
        }

        const aggregatedItems = Array.from(map.values());

        // Combine aggregated non-custom items with original custom items
        itemsForOutput = [...aggregatedItems, ...customItems];

        // Compute averages for aggregate-based fields (Heart Rate, VO2 Max)
        for (const it of itemsForOutput) {
          const a = (it?.attributes || {}) as Record<string, any>;
          if (a?._bpmCount && a?.bpm != null && !Number.isNaN(Number(a.bpm))) {
            a.bpm = Math.round(Number(a.bpm) / Number(a._bpmCount));
          }
          if (
            a?._vo2Count &&
            a?.vo2max != null &&
            !Number.isNaN(Number(a.vo2max))
          ) {
            a.vo2max = Math.round(Number(a.vo2max) / Number(a._vo2Count));
          }
          // Clean up temp counters
          if ('_bpmCount' in a) delete a._bpmCount;
          if ('_vo2Count' in a) delete a._vo2Count;
          if ('_durationMin' in a) delete a._durationMin;
          if ('_aggregate' in a) delete a._aggregate;
        }

        // Now clean attributes for output formatting after averages are computed
        for (const it of itemsForOutput) {
          it.attributes = cleanAttributes(it);
        }

        // Build human-friendly titles with count + unit per category
        for (const it of itemsForOutput) {
          const categoryName = it?.category?.name || '';
          const a = (it?.attributes || {}) as Record<string, any>;
          let title = it.title as string;

          // Only retitle aggregated items (identified via clubbedItemIds)
          const isAggregated =
            Array.isArray(a.clubbedItemIds) && a.clubbedItemIds.length > 0;
          if (!isAggregated) {
            it.title = title;
            continue;
          }

          if (categoryName === 'Steps' && a.steps != null) {
            title = `${Number(a.steps)} steps`;
          } else if (categoryName === 'Miles' && a.miles != null) {
            const milesVal = Number(a.miles);
            title = `${Number.isFinite(milesVal) ? milesVal.toFixed(2) : a.miles} miles`;
          } else if (categoryName === 'Heart Rate' && a.bpm != null) {
            const bpmVal = Math.round(Number(a.bpm));
            title = `${Number.isFinite(bpmVal) ? bpmVal : a.bpm} bpm`;
          } else if (categoryName === 'Sleep' && a.duration != null) {
            title = `${a.duration}`;
          } else if (categoryName === 'VO2 Max' && a.vo2max != null) {
            title = `${Number(a.vo2max)} vo2 max`;
          }

          it.title = title;
        }

        // Adjust totalCount to reflect aggregated item count for this condition only
        metadata.totalCount = itemsForOutput.length;
      }

      const musicList = await this.prismaService.lists.findFirst({
        where: {
          name: ListNames.MUSIC,
          ...ACTIVE_CONDITION,
        },
        select: {
          listId: true,
        },
      });

      if (filterDto.listId === musicList?.listId) {
        try {
          const map = new Map<string, any>();
          const offset = filterDto.timezoneOffsetMinutes ?? 0;

          // Sort listItems by timestamp descending to ensure newest records are processed first
          const sortedListItems = (listItems as any[]).slice().sort((a, b) => {
            const getTs = (it: any) => {
              const attr = (it?.attributes || {}) as Record<string, any>;
              const raw = attr.syncedAt || it.createdOn;
              return raw ? new Date(raw).getTime() : 0;
            };
            return getTs(b) - getTs(a);
          });

          for (const item of sortedListItems) {
            const attr = (item?.attributes || {}) as Record<string, any>;
            const syncedAt = attr.syncedAt || item.createdOn;

            if (!syncedAt) continue;

            // Calculate local date based on offset
            const localTime = moment(syncedAt).utcOffset(offset);
            const date = localTime.format('YYYY-MM-DD');

            if (!map.has(date)) {
              map.set(date, {
                ...item,
                title: '',
                attributes: {
                  date,
                  syncedAt: localTime.toISOString(),
                  songs: [],
                  clubbedItemIds: [],
                },
              });
            }

            const agg = map.get(date);
            const a = agg.attributes;

            const currentSongs = attr.songs || [];
            if (Array.isArray(currentSongs)) {
              a.songs.push(...currentSongs);
            }

            if (item?.listItemId) {
              if (!a.clubbedItemIds.includes(item.listItemId)) {
                a.clubbedItemIds.push(item.listItemId);
              }
            }
          }

          itemsForOutput = Array.from(map.values()).map((item) => {
            // Deduplicate songs by trackId
            const uniqueSongsMap = new Map();
            if (Array.isArray(item.attributes.songs)) {
              item.attributes.songs.forEach((song: any) => {
                if (song && song.trackId && !uniqueSongsMap.has(song.trackId)) {
                  uniqueSongsMap.set(song.trackId, song);
                }
              });
            }
            item.attributes.songs = Array.from(uniqueSongsMap.values());

            const songCount = item.attributes.songs.length;
            item.title = `${songCount} song${songCount !== 1 ? 's' : ''}`;
            return item;
          });

          metadata.totalCount = itemsForOutput.length;
        } catch (e) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'failed to aggregate music items',
            data: {
              service: ListItemsService.name,
              method: MethodNames.findAll,
              error: e instanceof Error ? e.message : String(e),
            },
          });
        }
      }

      const getSortTimestamp = (item: any): number => {
        const attr = (item?.attributes || {}) as Record<string, any>;
        const raw = attr.startDate ?? attr.date ?? item?.createdAt;
        if (!raw) return 0;
        if (raw instanceof Date) return raw.getTime();
        const t = Date.parse(String(raw));
        return Number.isFinite(t) ? t : 0;
      };

      // Sort by attributes.startDate (preferred) or attributes.date, fallback createdAt (newest first)
      itemsForOutput = itemsForOutput
        .slice()
        .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

      const hasCategories = itemsForOutput.some(
        (it) =>
          it?.category?.name && String(it.category.name).trim().length > 0,
      );

      if (hasCategories || listCategories.length > 0) {
        const grouped: Record<string, any[]> = {};

        const normalizeGroupKey = (raw: any): string | null => {
          const key = String(raw ?? '').trim();
          if (!key) return null;
          if (key.toLowerCase() === 'uncategorized') return null;
          return key;
        };

        // Initialize groups from available list categories so they show even if there are no items
        if (listCategories.length > 0) {
          for (const category of listCategories) {
            const key = normalizeGroupKey(category?.name);
            if (!key) continue;
            if (!grouped[key]) grouped[key] = [];
          }
        }

        // Add items into appropriate groups
        for (const item of itemsForOutput) {
          const key = normalizeGroupKey(item?.category?.name || item?.title);
          if (!key) continue;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(this.cleanListItem(item));
        }

        response.data = { data: [grouped], metadata };
      } else {
        response.data = {
          data: itemsForOutput.map((item) => this.cleanListItem(item)),
          metadata,
        };
      }

      if (filterDto.listId) {
        try {
          const integrationStatus =
            await this.integrationsService.getAllStatuses(
              userId,
              filterDto.listId,
            );
          response.data = { ...response.data, integrationStatus };
        } catch (e) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'failed to get integration statuses',
            data: {
              service: ListItemsService.name,
              method: MethodNames.findAll,
              userId,
              listId: filterDto.listId,
              error: e instanceof Error ? e.message : String(e),
            },
          });
        }
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'find all list items successfully',
        data: { service: ListItemsService.name, method: MethodNames.findAll },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find all list items failed',
        data: { service: ListItemsService.name, method: MethodNames.findAll },
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

  async findUnique(listItemId: string, date?: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'find unique list item',
      data: { service: ListItemsService.name, method: MethodNames.findUnique },
      input: { listItemId },
    });

    try {
      const result = await this.prismaService.listItems.findUnique({
        where: {
          listItemId_recSeq: { listItemId, recSeq: REC_SEQ.DEFAULT_RECORD },
          ...ACTIVE_CONDITION,
        },
        include: {
          userList: {
            select: {
              customName: true,
            },
          },
          list: {
            select: {
              name: true,
              listId: true,
            },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!result) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'find unique list item failed',
          data: {
            service: ListItemsService.name,
            method: MethodNames.findUnique,
          },
          input: { listItemId },
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      const relatedCategories =
        await this.prismaService.itemCategories.findMany({
          where: {
            listId: result.listId,
            ...ACTIVE_CONDITION,
          },
          select: {
            itemCategoryId: true,
            name: true,
          },
        });

      if (
        result.attributes &&
        typeof result.attributes === 'object' &&
        !Array.isArray(result.attributes)
      ) {
        const attributes = result.attributes as ListItemAttributes;
        if ('images' in attributes && Array.isArray(attributes.images)) {
          // Process images to get signed URLs
          const processedImages = await Promise.all(
            // Update the type assertion for the images array
            (attributes.images as Array<string | { url: string }>)
              .filter((img): img is string | { url: string } => {
                // Keep only valid string URLs or objects with url property
                if (typeof img === 'string') return true;
                return !!(
                  img &&
                  typeof img === 'object' &&
                  'url' in img &&
                  typeof img.url === 'string'
                );
              })
              .map(async (img) => {
                const url = typeof img === 'string' ? img : img.url;
                const signedUrl = await this.utilityService.getSignedUrl(url);
                return {
                  ...(typeof img === 'object' ? img : {}),
                  url: signedUrl.url,
                  size: signedUrl.size,
                  originalUrl: url,
                } as ProcessedImage;
              }),
          );

          // Update the attributes with processed images
          attributes.images = processedImages;
        }
      }

      if (result.list.name === 'Music') {
        const attr: any = result.attributes as any;
        if (Array.isArray(attr)) {
          if (date) {
            const format = (d?: string) =>
              d ? this.utilityService.formatDate(d) : undefined;
            const target = format(String(date));
            const matching = (
              attr as Array<{ date?: string; songs?: any }>
            ).filter((it) => format(it?.date) === target);

            const songs = matching.map((it) => it?.songs).filter(Boolean);

            response.data = {
              ...result,
              attributes: {
                date: String(date),
                songs,
              },
              categories: relatedCategories,
            };

            this.loggerInstance.logger(LogType.INFO, {
              message:
                'find unique list item successfully (Music array attributes filtered by date)',
              data: {
                service: ListItemsService.name,
                method: MethodNames.findUnique,
              },
              output: response,
            });

            return response;
          }
        }
        // Case B: attributes is an object with optional date and songs[]
        else if (attr && typeof attr === 'object') {
          const attributes = attr as { date?: string; songs?: any[] };
          if (attributes?.songs && Array.isArray(attributes.songs)) {
            const attributeDate = attributes.date;
            if (attributeDate && date) {
              const formattedAttr =
                this.utilityService.formatDate(attributeDate);
              const formattedParam = this.utilityService.formatDate(date);

              if (formattedAttr !== formattedParam) {
                response.data = {
                  ...result,
                  attributes: {
                    ...attributes,
                    songs: [],
                  },
                  categories: relatedCategories,
                };

                this.loggerInstance.logger(LogType.INFO, {
                  message:
                    'find unique list item successfully (Music filtered - no matching date)',
                  data: {
                    service: ListItemsService.name,
                    method: MethodNames.findUnique,
                  },
                  output: response,
                });

                return response;
              }
            }
          }
        }
      }

      // -----------------------------------------------
      // 3. STANDARD RETURN (no filtering applied)
      // -----------------------------------------------
      response.data = {
        ...result,
        categories: relatedCategories,
      };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'find unique list item successfully',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findUnique,
        },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'find unique list item failed',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findUnique,
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

  async fetchListItemsByDate(
    filterDto: ListItemsByDateFilterDto,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'fetch list items by date',
      data: {
        service: ListItemsService.name,
        method: MethodNames.findAll,
      },
      input: filterDto,
    });

    try {
      const result = await this.prismaService.listItems.findMany({
        where: {
          userListId: filterDto.userListId,
          listId: filterDto.listId,
          AND: [
            {
              attributes: {
                path: ['syncedAt'],
                gte: filterDto.startTime,
              },
            },
            {
              attributes: {
                path: ['syncedAt'],
                lte: filterDto.endTime,
              },
            },
          ],
          ...ACTIVE_CONDITION,
        },
      });

      if (result && result.length > 0) {
        const sortedResult = result.sort((a, b) => {
          const dateA = new Date(
            (a.attributes as any)?.syncedAt || 0,
          ).getTime();
          const dateB = new Date(
            (b.attributes as any)?.syncedAt || 0,
          ).getTime();
          return dateB - dateA;
        });

        const allSongs = [];
        const trackIds = new Set();

        for (const item of sortedResult) {
          const songs = (item.attributes as any)?.songs || [];
          for (const song of songs) {
            if (!trackIds.has(song.trackId)) {
              allSongs.push(song);
              trackIds.add(song.trackId);
            }
          }
        }

        response.data = {
          title: `${allSongs.length} songs`,
          listId: filterDto.listId,
          userListId: filterDto.userListId,
          startTime: filterDto.startTime,
          endTime: filterDto.endTime,
          songs: allSongs,
        };
      } else {
        response.data = {
          title: `0 songs`,
          listId: filterDto.listId,
          userListId: filterDto.userListId,
          startTime: filterDto.startTime,
          endTime: filterDto.endTime,
          songs: [],
        };
      }
      this.loggerInstance.logger(LogType.INFO, {
        message: 'fetch list items by date successfully',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'fetch list items by date failed',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findAll,
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

  async update(
    listItemId: string,
    updateDto: UpdateListItemDto,
    userId: string,
    images?: Express.Multer.File[],
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'update list item',
      data: { service: ListItemsService.name, method: MethodNames.update },
      input: { listItemId, updateDto },
    });

    try {
      const existingRecord = await this.prismaService.listItems.findUnique({
        where: {
          listItemId_recSeq: {
            listItemId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });

      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'update list item failed - not found',
          data: { service: ListItemsService.name, method: MethodNames.update },
          input: listItemId,
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      // Parse JSON fields using the same helper as in create
      const parseJsonField = (
        field: any,
        fieldName: string,
      ): Record<string, any> | null => {
        if (!field) return null;
        try {
          return typeof field === 'string' ? JSON.parse(field) : { ...field };
        } catch (e) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Error parsing ${fieldName}`,
            error: e,
            [fieldName]: field,
          });
          return null;
        }
      };

      // Parse the incoming attributes
      const updateAttributes =
        parseJsonField(updateDto.attributes, 'attributes') || {};
      const existingAttributes = (existingRecord.attributes || {}) as Record<
        string,
        any
      >;
      const attributeDataType = parseJsonField(
        updateDto.attributeDataType,
        'attributeDataType',
      );
      const unit = parseJsonField(updateDto.unit, 'unit');

      // Start with existing attributes and update with new values
      const mergedAttributes = {
        ...existingAttributes,
        ...updateAttributes,
        images: [], // Initialize empty array, we'll handle images separately
      };

      // Helper function to extract filename from a full URL or return as-is if already a filename
      const extractFileName = (urlOrFileName: string): string => {
        if (!urlOrFileName) return urlOrFileName;
        // If it's a full URL (starts with http), extract just the filename
        if (urlOrFileName.startsWith('http')) {
          // Remove query parameters and get the path
          const pathWithoutQuery = urlOrFileName.split('?')[0];
          // Get the filename (last part after /)
          const filename = pathWithoutQuery.split('/').pop() || urlOrFileName;
          // Decode URL-encoded characters
          return decodeURIComponent(filename);
        }
        // Already a filename, decode it in case it contains URL-encoded characters
        return decodeURIComponent(urlOrFileName);
      };

      // Handle file uploads
      // First, determine the base images (from payload or existing)
      let baseImages: any[] = [];

      if (updateAttributes.images !== undefined) {
        // If images were provided in the update payload, use those as base
        const payloadImages = Array.isArray(updateAttributes.images)
          ? updateAttributes.images
          : updateAttributes.images
            ? [updateAttributes.images]
            : [];
        // Extract filenames from full URLs
        baseImages = payloadImages.map((img) => extractFileName(img));
      } else {
        // Otherwise, keep existing images as base
        baseImages = Array.isArray(existingAttributes.images)
          ? existingAttributes.images
          : existingAttributes.images
            ? [existingAttributes.images]
            : [];
      }

      // Then, add any newly uploaded files to the base images
      if (images && images.length > 0) {
        const imageUrls = await Promise.all(
          images.map(async (image) => {
            return this.utilityService.uploadFile(image);
          }),
        ).then((urls) => urls.filter((url): url is string => Boolean(url)));

        if (imageUrls.length > 0) {
          // Extract filenames from the newly uploaded image URLs
          const extractedNewImages = imageUrls.map((url) =>
            extractFileName(url),
          );
          // Add new images to base images, ensuring no duplicates
          mergedAttributes.images = [
            ...new Set([...baseImages, ...extractedNewImages]),
          ].filter(Boolean);
        } else {
          mergedAttributes.images = baseImages;
        }
      } else {
        // No new file uploads, use base images
        mergedAttributes.images = baseImages;
      }

      // Prepare update data (exclude top-level images; images are managed within attributes)
      const { images: _omitImages, ...sanitizedDto } = updateDto;
      const updateData = {
        ...sanitizedDto,
        attributes: mergedAttributes,
        attributeDataType:
          attributeDataType || existingRecord.attributeDataType,
        unit: unit || existingRecord.unit,
        modifiedBy: userId,
        categoryId:
          sanitizedDto.categoryId === '' ? null : sanitizedDto.categoryId,
      };

      const updatedStatus = await this.utilityService.updateEntity({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.LIST_ITEMS,
        updateData,
        primaryKeyCriteria: { listItemId },
        requestId: userId,
        username: userId,
      });

      response.data = updatedStatus;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'update list item successfully',
        data: { service: ListItemsService.name, method: MethodNames.update },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'update list item failed',
        data: { service: ListItemsService.name, method: MethodNames.update },
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

  async delete(listItemId: string, userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete list item',
      data: { service: ListItemsService.name, method: MethodNames.delete },
      input: { listItemId, userId },
    });

    try {
      const existingRecord = await this.prismaService.listItems.findFirst({
        where: {
          listItemId,
          recSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (!existingRecord) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete list item failed - not found',
          data: { service: ListItemsService.name, method: MethodNames.delete },
          input: { listItemId, userId },
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      if (existingRecord.createdBy !== userId) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete list item failed - forbidden',
          data: { service: ListItemsService.name, method: MethodNames.delete },
          input: { listItemId, userId },
        });
        return {
          status: HttpStatus.FORBIDDEN,
          data: RESPONSE_STATUS.ERROR.FORBIDDEN,
        };
      }

      await this.prismaService.listItems.update({
        where: {
          listItemId_recSeq: {
            listItemId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });

      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete list item successfully',
        data: { service: ListItemsService.name, method: MethodNames.delete },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete list item failed',
        data: { service: ListItemsService.name, method: MethodNames.delete },
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

  async deleteMany(
    deleteDto: DeleteListItemDto,
    userId: string,
  ): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    this.loggerInstance.logger(LogType.INFO, {
      message: 'delete many list items',
      data: { service: ListItemsService.name, method: MethodNames.delete },
      input: { deleteDto, userId },
    });

    try {
      const { listItemIds } = deleteDto;

      const existingRecords = await this.prismaService.listItems.findMany({
        where: {
          listItemId: {
            in: listItemIds,
          },
          recSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
        select: {
          createdBy: true,
        },
      });

      const isForbidden = existingRecords.some(
        (record) => record.createdBy !== userId,
      );

      if (isForbidden) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete many list items failed - forbidden',
          data: { service: ListItemsService.name, method: MethodNames.delete },
          input: { deleteDto, userId },
        });
        return {
          status: HttpStatus.FORBIDDEN,
          data: RESPONSE_STATUS.ERROR.FORBIDDEN,
        };
      }

      if (existingRecords.length < listItemIds.length) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'delete many list items failed - not found',
          data: { service: ListItemsService.name, method: MethodNames.delete },
          input: { deleteDto, userId },
        });
        return {
          status: HttpStatus.NOT_FOUND,
          data: RESPONSE_STATUS.ERROR.NOT_FOUND,
        };
      }

      await this.prismaService.listItems.updateMany({
        where: {
          listItemId: {
            in: listItemIds,
          },
          recSeq: REC_SEQ.DEFAULT_RECORD,
          createdBy: userId,
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: REC_STATUS.INACTIVE },
      });

      response.data = RESPONSE_STATUS.SUCCESS.DELETE;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'delete many list items successfully',
        data: { service: ListItemsService.name, method: MethodNames.delete },
        output: response,
      });

      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'delete many list items failed',
        data: { service: ListItemsService.name, method: MethodNames.delete },
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

  async itemListDropDown(userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    try {
      const itemLists = await this.prismaService.userLists.findMany({
        where: {
          userId,
          ...ACTIVE_CONDITION,
          list: {
            is: {
              ...ACTIVE_CONDITION,
            },
          },
        },
        select: {
          userListId: true,
          customName: true,
          list: {
            select: {
              listId: true,
              name: true,
              categories: {
                select: {
                  itemCategoryId: true,
                  name: true,
                },
                where: {
                  ...ACTIVE_CONDITION,
                },
              },
            },
          },
        },
      });

      // Sort itemLists based on LIST_ORDER by list name; fallback to alphabetical for unknown names
      const orderMap = LIST_ORDER as Record<string, number>;
      const getOrder = (name?: string | null) => {
        const n = name || '';
        return orderMap[n] ?? Number.MAX_SAFE_INTEGER;
      };
      const sortedItemLists = [...itemLists].sort((a: any, b: any) => {
        const aName = a?.list?.name || '';
        const bName = b?.list?.name || '';
        const ao = getOrder(aName);
        const bo = getOrder(bName);
        if (ao !== bo) return ao - bo;
        return aName.localeCompare(bName);
      });

      const lists = await this.userListService.listDropDown(userId);

      response.data = { itemLists: sortedItemLists, lists: lists?.data };

      this.loggerInstance.logger(LogType.INFO, {
        message: 'list drop down successfully',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findAll,
        },
        output: response,
      });
      return response;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'list drop down failed',
        data: {
          service: ListItemsService.name,
          method: MethodNames.findAll,
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
}
