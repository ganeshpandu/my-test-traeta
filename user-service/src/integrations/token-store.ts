import { Injectable } from '@nestjs/common';
import { PrismaService } from '@traeta/prisma';
import { ACTIVE_CONDITION, REC_SEQ, PROVIDER_NAMINGS } from '../../constants';
import * as crypto from 'crypto';

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch seconds
  scope?: string;
  providerUserId?: string; // e.g., Strava athlete id
};

export abstract class TokenStore {
  abstract get(userId: string, provider: string): Promise<OAuthTokens | null>;
  abstract set(
    userId: string,
    provider: string,
    tokens: OAuthTokens,
  ): Promise<void>;
  abstract delete(userId: string, provider: string): Promise<void>;
}

// NOTE: In-memory only for development. Replace with a secure external store in production.
@Injectable()
export class InMemoryTokenStore extends TokenStore {
  private store = new Map<string, OAuthTokens>();

  private key(userId: string, provider: string) {
    return `${provider}:${userId}`;
  }

  async get(userId: string, provider: string): Promise<OAuthTokens | null> {
    return this.store.get(this.key(userId, provider)) ?? null;
  }

  async set(
    userId: string,
    provider: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    this.store.set(this.key(userId, provider), tokens);
  }

  async delete(userId: string, provider: string): Promise<void> {
    this.store.delete(this.key(userId, provider));
  }
}

// AES-256-GCM helpers for encrypting tokens at rest
function getKey(): Buffer {
  const k = process.env.TOKEN_CRYPTO_KEY || '';
  if (!k) throw new Error('TOKEN_CRYPTO_KEY is required for PrismaTokenStore');
  // Accept hex or base64; fallback to utf8 padded/truncated to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(k)) return Buffer.from(k, 'hex');
  const b = Buffer.from(k, k.length % 4 === 0 ? 'base64' : 'utf8');
  return b.length >= 32
    ? b.subarray(0, 32)
    : Buffer.concat([b, Buffer.alloc(32 - b.length, 0)]);
}

function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    enc.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

function decrypt(payload: string): string {
  const [ivB64, encB64, tagB64] = payload.split(':');
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

// Prisma-backed encrypted token store
@Injectable()
export class PrismaTokenStore extends TokenStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async getIntegrationId(provider: string) {
    const integ = await this.prisma.integrations.findFirst({
      where: { name: provider },
    });
    if (!integ)
      throw new Error(`Integration not found: ${PROVIDER_NAMINGS[provider]}`);
    return {
      integrationId: integ.integrationId,
      integrationRecSeq: integ.recSeq,
    };
  }

  async get(userId: string, provider: string): Promise<OAuthTokens | null> {
    const { integrationId, integrationRecSeq } =
      await this.getIntegrationId(provider);
    const row = await this.prisma.oAuthCredentials.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId,
        integrationRecSeq,
        ...ACTIVE_CONDITION,
      },
    });
    if (!row) return null;
    const accessToken = decrypt(row.accessTokenEnc);
    const refreshToken = row.refreshTokenEnc
      ? decrypt(row.refreshTokenEnc)
      : undefined;
    const expiresAt = row.expiresAt
      ? Math.floor(new Date(row.expiresAt).getTime() / 1000)
      : undefined;
    return {
      accessToken,
      refreshToken,
      expiresAt,
      scope: row.scope ?? undefined,
      providerUserId: row.providerUserId ?? undefined,
    };
  }

  async set(
    userId: string,
    provider: string,
    tokens: OAuthTokens,
  ): Promise<void> {
    const { integrationId, integrationRecSeq } =
      await this.getIntegrationId(provider);
    const accessTokenEnc = encrypt(tokens.accessToken);
    const refreshTokenEnc = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : null;
    const expiresAt = tokens.expiresAt
      ? new Date(tokens.expiresAt * 1000)
      : null;

    const existing = await this.prisma.oAuthCredentials.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId,
        integrationRecSeq,
        ...ACTIVE_CONDITION,
      },
    });

    if (existing) {
      await this.prisma.oAuthCredentials.update({
        where: {
          oauthCredentialId_recSeq: {
            oauthCredentialId: existing.oauthCredentialId,
            recSeq: existing.recSeq,
          },
        },
        data: {
          accessTokenEnc,
          refreshTokenEnc,
          expiresAt,
          scope: tokens.scope ?? null,
          providerUserId: tokens.providerUserId ?? null,
        },
      });
    } else {
      await this.prisma.oAuthCredentials.create({
        data: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId,
          integrationRecSeq,
          accessTokenEnc,
          refreshTokenEnc,
          expiresAt,
          scope: tokens.scope ?? null,
          providerUserId: tokens.providerUserId ?? null,
        },
      });
    }
  }

  async delete(userId: string, provider: string): Promise<void> {
    const { integrationId, integrationRecSeq } =
      await this.getIntegrationId(provider);
    const existing = await this.prisma.oAuthCredentials.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId,
        integrationRecSeq,
        ...ACTIVE_CONDITION,
      },
    });

    if (existing) {
      await this.prisma.oAuthCredentials.delete({
        where: {
          oauthCredentialId_recSeq: {
            oauthCredentialId: existing.oauthCredentialId,
            recSeq: existing.recSeq,
          },
        },
      });
    }
  }
}
