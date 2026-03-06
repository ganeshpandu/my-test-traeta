import { Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { ACTIVE_CONDITION, ListNames, REC_SEQ, STATUS, SYNC_TIMEOUT_MS } from '../../constants';

@Injectable()
export class IntegrationPersistence {
  constructor(private prisma: PrismaService) {}

  // Ensure Integration by name (e.g., 'strava')
  async ensureIntegration(name: string) {
    const existing = await this.prisma.integrations.findFirst({
      where: { name, ...ACTIVE_CONDITION },
    });
    if (existing) return existing;
  }

  // Ensure UserIntegrations link
  async ensureUserIntegration(userId: string, integrationId: string) {
    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });
    if (link) return link;

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.userIntegrations.create({
        data: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          status: STATUS.PENDING,
          ...ACTIVE_CONDITION,
        },
      });
      await tx.userIntegrationHistory.create({
        data: {
          userIntegrationId: created.userIntegrationId,
          userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          firstConnectedAt: new Date(),
          ...ACTIVE_CONDITION,
        },
      });
      return created;
    });
  }

  async markConnected(userId: string, integrationId: string) {
    const link = await this.ensureUserIntegration(userId, integrationId);
    await this.prisma.userIntegrations.update({
      where: {
        userIntegrationId_recSeq: {
          userIntegrationId: link.userIntegrationId,
          recSeq: REC_SEQ.DEFAULT_RECORD,
        },
        ...ACTIVE_CONDITION,
      },
      data: { status: STATUS.CONNECTED, ...ACTIVE_CONDITION },
    });
    await this.prisma.userIntegrationHistory.updateMany({
      where: {
        userIntegrationId: link.userIntegrationId,
        userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
      data: { lastConnectedAt: new Date(), ...ACTIVE_CONDITION },
    });
    const integration = await this.prisma.integrations.findUnique({
      where: {
        integrationId_recSeq: {
          integrationId: link.integrationId,
          recSeq: REC_SEQ.DEFAULT_RECORD,
        },
        ...ACTIVE_CONDITION,
      },
    });
    if (integration) {
      await this.prisma.integrations.update({
        where: {
          integrationId_recSeq: {
            integrationId: link.integrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: {
          popularity: integration.popularity ? integration.popularity + 1 : 1,
        },
      });
    }
    return link;
  }

  async markSynced(linkId: string, syncedAt?: Date) {
    await this.prisma.userIntegrationHistory.updateMany({
      where: {
        userIntegrationId: linkId,
        userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
      data: { lastSyncedAt: syncedAt ?? new Date(), ...ACTIVE_CONDITION },
    });
  }

  async markDisconnected(userId: string, integrationName: string) {
    // First, get the integration by name to get the actual integrationId
    const integration = await this.ensureIntegration(integrationName);

    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });

    if (link) {
      await this.prisma.userIntegrations.update({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: link.userIntegrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { status: STATUS.DISCONNECTED, ...ACTIVE_CONDITION },
      });
    }

    return link;
  }

  async markSyncInProgress(userId: string, integrationName: string) {
    // First, get the integration by name to get the actual integrationId
    const integration = await this.ensureIntegration(integrationName);

    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });

    if (link) {
      await this.prisma.userIntegrations.update({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: link.userIntegrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { status: STATUS.SYNCING, ...ACTIVE_CONDITION },
      });
    }

    return link;
  }

  async isSyncing(userId: string, integrationName: string): Promise<boolean> {
    const integration = await this.ensureIntegration(integrationName);

    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });

    if (link?.status !== STATUS.SYNCING) {
      return false;
    }

    // Check if sync is stuck (exceeds timeout)
    const now = new Date();
    const lastModified = link.modifiedOn;
    if (now.getTime() - lastModified.getTime() > SYNC_TIMEOUT_MS) {
      // Sync is likely stuck due to server restart/crash
      // Mark it as connected so user can try again
      await this.markSyncCompleted(userId, integrationName, false);
      return false;
    }

    return true;
  }

  async markSyncCompleted(
    userId: string,
    integrationName: string,
    success: boolean = true,
  ) {
    const integration = await this.ensureIntegration(integrationName);

    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });

    if (link) {
      await this.prisma.userIntegrations.update({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: link.userIntegrationId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { status: STATUS.CONNECTED, ...ACTIVE_CONDITION },
      });
      if (success) {
        await this.markSynced(link.userIntegrationId);
      }
    }

    return link;
  }

  async getLastSyncedAt(userId: string, integrationId: string) {
    const link = await this.prisma.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });
    if (!link) return null;
    const hist = await this.prisma.userIntegrationHistory.findFirst({
      where: {
        userIntegrationId: link.userIntegrationId,
        userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });
    return hist?.lastSyncedAt ?? null;
  }

  // Ensure List + UserLists + Category
  async ensureListAndCategoryForUser(
    userId: string,
    listName: string,
    categoryName?: string,
  ) {
    try {
      return this.prisma.$transaction(async (tx) => {
        const list = await tx.lists.findFirst({
          where: { name: listName, ...ACTIVE_CONDITION },
        });

        const user = await tx.users.findFirst({
          where: {
            userId,
            recSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        });

        if (!user) {
          throw new Error(
            `User not found for userId: ${userId} with recSeq: ${REC_SEQ.DEFAULT_RECORD}`,
          );
        }

        const userList =
          (await tx.userLists.findFirst({
            where: {
              userId,
              userRecSeq: REC_SEQ.DEFAULT_RECORD,
              listId: list.listId,
              listRecSeq: REC_SEQ.DEFAULT_RECORD,
              ...ACTIVE_CONDITION,
            },
          })) ?? null;

        let category: any = null;
        if (categoryName) {
          category =
            (await tx.itemCategories.findFirst({
              where: {
                listId: list.listId,
                listRecSeq: REC_SEQ.DEFAULT_RECORD,
                name: categoryName,
                ...ACTIVE_CONDITION,
              },
            })) ?? null;
        }
        return { list, userList, category };
      });
    } catch (error) {
      throw error;
    }
  }

  // Create item with attributes; external provider id can be stored inside attributes
  async createListItem(
    listId: string,
    listRecSeq: number,
    userListId: string,
    userListRecSeq: number,
    categoryId: string | null,
    categoryRecSeq: number | null,
    title: string,
    attributes: any,
    attributeDataType: any,
    userId: string,
    notes?: string,
  ) {
    return this.prisma.listItems.create({
      data: {
        listId,
        listRecSeq,
        userListId,
        userListRecSeq,
        categoryId: categoryId ?? null,
        categoryRecSeq: REC_SEQ.DEFAULT_RECORD,
        title,
        notes: notes || '',
        attributes,
        attributeDataType,
        isCustom: false,
        createdBy: userId,
        ...ACTIVE_CONDITION,
      },
    });
  }

  // Check if an email already exists by external ID (Gmail message ID)
  async emailExists(
    listId: string,
    listRecSeq: number,
    userListId: string,
    externalId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.listItems.findFirst({
      where: {
        listId,
        listRecSeq,
        userListId,
        attributes: {
          path: ['external', 'id'],
          equals: externalId,
        },
        ...ACTIVE_CONDITION,
      },
    });
    return !!existing;
  }

  async orderIdExists(
    listId: string,
    listRecSeq: number,
    userListId: string,
    orderId: string,
  ) {
    if (!orderId) return false;
    const existing = await this.prisma.listItems.findFirst({
      where: {
        listId,
        listRecSeq,
        userListId,
        attributes: {
          path: ['orderId'],
          equals: orderId,
        },
        ...ACTIVE_CONDITION,
      },
    });
    return !!existing;
  }

  // Find an existing item by external provider ID
  async findItemByExternalId(
    listId: string,
    listRecSeq: number,
    userListId: string,
    userListRecSeq: number,
    title: string,
    provider: string,
    externalId: string,
  ) {
    return this.prisma.listItems.findFirst({
      where: {
        listId,
        listRecSeq,
        userListId,
        userListRecSeq,
        title,
        attributes: {
          path: ['external', 'provider'],
          equals: provider,
        },
        AND: {
          attributes: {
            path: ['external', 'id'],
            equals: externalId,
          },
        },
        ...ACTIVE_CONDITION,
      },
    });
  }

  // Find an existing item by external ID only (without matching title) - used for Apple Music daily rollups
  async findItemByExternalIdOnly(
    listId: string,
    listRecSeq: number,
    userListId: string,
    userListRecSeq: number,
    externalId: string,
    provider: string,
    startTime?: string | Date,
    endTime?: string | Date,
    date?: string,
    activityDuration?: string,
  ) {
    const byId = await this.prisma.listItems.findFirst({
      where: {
        listId,
        listRecSeq,
        userListId,
        userListRecSeq,
        attributes: {
          path: ['external', 'id'],
          equals: externalId,
        },
        ...ACTIVE_CONDITION,
      },
    });
    if (byId) {
      return byId;
    }

    if (startTime && endTime) {
      const startIso = new Date(startTime).toISOString();
      const endIso = new Date(endTime).toISOString();

      const overlap = await this.prisma.listItems.findFirst({
        where: {
          listId,
          listRecSeq,
          userListId,
          userListRecSeq,
          AND: [
            { attributes: { path: ['date'], equals: date } },
            {
              attributes: {
                path: ['activityDuration'],
                equals: activityDuration,
              },
            },
            { attributes: { path: ['startTime'], gte: startIso } },
            { attributes: { path: ['endTime'], lte: endIso } },
            {
              NOT: {
                attributes: {
                  path: ['external', 'provider'],
                  equals: provider,
                },
              },
            },
          ],
          ...ACTIVE_CONDITION,
        },
      });
      if (overlap) {
        return overlap;
      }
    }

    if (date && activityDuration && startTime) {
      const start = new Date(startTime);
      const windowStart = new Date(
        start.getTime() - 2 * 60 * 1000,
      ).toISOString();
      const windowEnd = new Date(start.getTime() + 2 * 60 * 1000).toISOString();

      const byDateDurStartWindow = await this.prisma.listItems.findFirst({
        where: {
          listId,
          listRecSeq,
          userListId,
          userListRecSeq,
          AND: [
            { attributes: { path: ['date'], equals: date } },
            {
              attributes: {
                path: ['activityDuration'],
                equals: activityDuration,
              },
            },
            { attributes: { path: ['startTime'], gte: windowStart } },
            { attributes: { path: ['startTime'], lte: windowEnd } },
            {
              NOT: {
                attributes: {
                  path: ['external', 'provider'],
                  equals: provider,
                },
              },
            },
          ],
          ...ACTIVE_CONDITION,
        },
      });
      if (byDateDurStartWindow) {
        return byDateDurStartWindow;
      }
    }
    return null;
  }

  private mergeAttributesForActivity(
    existingAttributes: any,
    incomingAttributes: any,
  ): any {
    const existing = existingAttributes ?? {};
    const incoming = incomingAttributes ?? {};

    const existingExternals = Array.isArray(existing.externals)
      ? existing.externals
      : existing.external
        ? [existing.external]
        : [];
    const incomingExternals = Array.isArray(incoming.externals)
      ? incoming.externals
      : incoming.external
        ? [incoming.external]
        : [];

    const externals = [...existingExternals, ...incomingExternals]
      .filter(Boolean)
      .filter((e: any) => e?.provider && e?.id)
      .reduce((acc: any[], e: any) => {
        const key = `${String(e.provider)}|${String(e.id)}|${String(e.type ?? '')}`;
        if (
          !acc.some(
            (x: any) =>
              `${String(x.provider)}|${String(x.id)}|${String(x.type ?? '')}` ===
              key,
          )
        ) {
          acc.push(e);
        }
        return acc;
      }, []);

    const merged: any = { ...existing };

    const existingHasAppleHealth = existingExternals.some(
      (e: any) => String(e?.provider) === 'apple_health',
    );
    const incomingHasAppleHealth = incomingExternals.some(
      (e: any) => String(e?.provider) === 'apple_health',
    );
    const keepAppleHealthAsSourceOfTruth =
      existingHasAppleHealth && !incomingHasAppleHealth;

    for (const [k, v] of Object.entries(incoming)) {
      if (k === 'external' || k === 'externals') continue;
      if (v === undefined || v === null) continue;

      if (keepAppleHealthAsSourceOfTruth) {
        const existingValue = existing[k];
        if (existingValue === undefined || existingValue === null) {
          merged[k] = v;
        }
        continue;
      }

      merged[k] = v;
    }

    if (existing.metadata || incoming.metadata) {
      merged.metadata = {
        ...(existing.metadata ?? {}),
        ...(incoming.metadata ?? {}),
      };
    }

    merged.externals = externals;
    const appleHealthExternal = externals.find(
      (e: any) => String(e?.provider) === 'apple_health',
    );
    if (appleHealthExternal) {
      merged.external = appleHealthExternal;
    } else if (!merged.external && externals.length > 0) {
      merged.external = externals[0];
    }

    return merged;
  }

  async upsertListItem(
    listId: string,
    listRecSeq: number,
    userListId: string,
    userListRecSeq: number,
    categoryId: string | null,
    categoryRecSeq: number | null,
    title: string,
    attributes: any,
    attributeDataType: any,
    userId: string,
    notes?: string,
  ) {
    if (attributes.external?.provider && attributes.external?.id) {
      let existing;
      const listname = await this.prisma.lists.findFirst({
        select: { name: true },
        where: { listId, ...ACTIVE_CONDITION },
      });
      const isActivityList =
        listname.name === ListNames.ACTIVITY ||
        listname.name === ListNames.HEALTH;

      if (isActivityList) {
        existing = await this.findItemByExternalIdOnly(
          listId,
          listRecSeq,
          userListId,
          userListRecSeq,
          attributes.external.id,
          attributes.external.provider,
          attributes.startTime,
          attributes.endTime,
          attributes.date,
          attributes.activityDuration,
        );
      } else {
        existing = await this.findItemByExternalId(
          listId,
          listRecSeq,
          userListId,
          userListRecSeq,
          title,
          attributes.external.provider,
          attributes.external.id,
        );
      }

      if (existing) {
        const nextAttributes = isActivityList
          ? this.mergeAttributesForActivity(existing?.attributes, attributes)
          : attributes;

        let nextTitle = title;
        if (isActivityList) {
          const existingTitle = existing.title ?? '';
          const incomingTitle = title ?? '';
          const existingLooksLikeDuration =
            /^[0-9]+h\s*[0-9]+m$/.test(existingTitle) ||
            /^[0-9]+m$/.test(existingTitle);
          const incomingHasDistance = /mile|miles|yard|yards/i.test(
            incomingTitle,
          );

          const getProviders = (attrs: any): string[] => {
            const external = attrs?.external;
            const externals = Array.isArray(attrs?.externals)
              ? attrs.externals
              : [];
            return [external, ...externals]
              .filter(Boolean)
              .map((e: any) => String(e?.provider ?? ''))
              .filter(Boolean);
          };

          const existingProviders = getProviders(existing.attributes);
          const incomingProviders = getProviders(attributes);
          const existingHasAppleHealth =
            existingProviders.includes('apple_health');
          const incomingHasAppleHealth =
            incomingProviders.includes('apple_health');

          if (incomingHasAppleHealth) {
            nextTitle = incomingTitle;
          } else if (existingHasAppleHealth) {
            nextTitle = existingTitle;
          } else if (existingLooksLikeDuration && incomingHasDistance) {
            nextTitle = incomingTitle;
          } else {
            nextTitle = incomingTitle;
          }
        }

        const attributesChanged =
          JSON.stringify(existing.attributes) !==
          JSON.stringify(nextAttributes);
        const titleChanged = existing.title !== nextTitle;
        const categoryChanged = existing.categoryId !== categoryId;

        if (attributesChanged || titleChanged || categoryChanged) {
          return this.prisma.listItems.update({
            where: {
              listItemId_recSeq: {
                listItemId: existing.listItemId,
                recSeq: REC_SEQ.DEFAULT_RECORD,
              },
            },
            data: {
              categoryId: categoryId ?? null,
              categoryRecSeq: REC_SEQ.DEFAULT_RECORD,
              notes: notes || existing.notes,
              title: nextTitle,
              attributes: nextAttributes,
              attributeDataType,
              isCustom: false,
              modifiedBy: userId,
              ...ACTIVE_CONDITION,
            },
          });
        }

        return existing;
      }
    }

    return this.createListItem(
      listId,
      listRecSeq,
      userListId,
      userListRecSeq,
      categoryId,
      categoryRecSeq,
      title,
      attributes,
      attributeDataType,
      userId,
      notes,
    );
  }
}
