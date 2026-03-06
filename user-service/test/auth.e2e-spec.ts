import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { App } from 'supertest/types';
import { REC_SEQ, RESPONSE_STATUS } from '../constants';
import { FirebaseService } from '../src/firebase/firebase.config';

// Minimal logger to silence logs during tests (does not affect DB/Firebase)
class LoggerMock {
  logger = jest.fn();
}

// Mock Firebase to avoid real token verification in e2e
class FirebaseServiceMock {
  public auth = {
    verifyIdToken: jest.fn().mockResolvedValue({ uid: UID }),
    getUser: jest
      .fn()
      .mockResolvedValue({ uid: UID, phoneNumber: '+917381985715' }),
  } as unknown as FirebaseService['auth'];
}

const UID = 'DNaxxGfkpdadvb46ztfdjzCYItZ2';
const TEST_ID_TOKEN =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6IjUwMDZlMjc5MTVhMTcwYWIyNmIxZWUzYjgxZDExNjU0MmYxMjRmMjAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vdHJ0YS01YTU3MyIsImF1ZCI6InRydGEtNWE1NzMiLCJhdXRoX3RpbWUiOjE3NTg3MTU1MzgsInVzZXJfaWQiOiJETmF4eEdma3BkYWR2YjQ2enRmZGp6Q1lJdFoyIiwic3ViIjoiRE5heHhHZmtwZGFkdmI0Nnp0ZmRqekNZSXRaMiIsImlhdCI6MTc1ODcxNTUzOCwiZXhwIjoxNzU4NzE5MTM4LCJwaG9uZV9udW1iZXIiOiIrOTE3MzgxOTg1NzE1IiwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJwaG9uZSI6WyIrOTE3MzgxOTg1NzE1Il19LCJzaWduX2luX3Byb3ZpZGVyIjoicGhvbmUifX0.U_VBGvb-06Pn7HDegsBG6JjSdC1ad0u0RzuYfbkNTAZzDS58x0vLqtRPlqVDquprsZEJ3OmNMVhq1YsGwpArmfkawHPukEVzR2Az865zvyqg5mcXVmUV7n75YPXdIYprF_w6I_nCqAOs5o7yLJCiLumI18c0s50vqBjp3n0rfIdehEqdH2tUO-2eEDIJR54YcKngxT-HlKXo6gOkzD14dT6IAvZptLs5mwVsUj-Ua2AHMc6cdIEFf1K3KRl5wbJRb4gqgGehc9ForDTyzXQTc9V89HxH-hShTsXzO0NK624b-rqkOYqq6CbDjXA6yvGksPb0yTXUhbIbuV3j5UJ8Og';

interface VerifyUserResponse {
  user: {
    userId: string;
    [key: string]: unknown;
  };
  token: string;
  count?: number;
}

interface RefreshTokenResponse {
  accessToken: string;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: App;

  // Tokens issued by the app during the test
  let issuedToken: string | null = null;

  beforeAll(async () => {
    // Ensure predictable JWT behavior in tests
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || 'test-jwt-access-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TechvLogger)
      .useClass(LoggerMock)
      .overrideProvider(FirebaseService)
      .useClass(FirebaseServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    server = app.getHttpServer() as App;

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$disconnect();
      }
    } finally {
      await app.close();
    }
  });

  describe('/auth/verifyuser (POST)', () => {
    it('returns 400 when idToken is undefined (raw string)', async () => {
      const res = await request(server).post('/auth/verifyuser').send({});

      expect(res.status).toBe(400);
      expect(res.text).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns 400 when idToken is empty (raw string)', async () => {
      const res = await request(server)
        .post('/auth/verifyuser')
        .send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.text).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns 200 and inserts user into DB on success (requires TEST_ID_TOKEN/UID)', async () => {
      try {
        await prisma.users.delete({
          where: {
            userId_recSeq: { userId: UID, recSeq: REC_SEQ.DEFAULT_RECORD },
          },
        });
      } catch {
        // ignore if not exists
      }

      const res = await request(server)
        .post('/auth/verifyuser')
        .send({ idToken: TEST_ID_TOKEN });

      expect(res.status).toBe(200);
      const verifyUserResponse = res.body as VerifyUserResponse;
      expect(verifyUserResponse).toHaveProperty('user');
      expect(verifyUserResponse).toHaveProperty('token');
      expect(verifyUserResponse.user).toHaveProperty('userId', UID);

      // Save issued token for refresh/logout flows
      issuedToken = verifyUserResponse.token;

      // Verify record exists in DB
      const user = await prisma.users.findUnique({
        where: {
          userId_recSeq: { userId: UID, recSeq: REC_SEQ.DEFAULT_RECORD },
        },
      });
      expect(user).not.toBeNull();
    });
  });

  describe('/auth/verifyuser (POST) existing user', () => {
    it('returns 200 on success when user exists (requires TEST_ID_TOKEN/UID)', async () => {
      // Ensure user exists (run verifyuser path if needed)
      const existing = await prisma.users.findUnique({
        where: {
          userId_recSeq: { userId: UID, recSeq: REC_SEQ.DEFAULT_RECORD },
        },
      });
      if (!existing) {
        await request(server)
          .post('/auth/verifyuser')
          .send({ idToken: TEST_ID_TOKEN });
      }

      const res = await request(server)
        .post('/auth/verifyuser')
        .send({ idToken: TEST_ID_TOKEN });

      expect(res.status).toBe(200);
      const verifyUserResponse = res.body as VerifyUserResponse;
      expect(verifyUserResponse).toHaveProperty('token');
      expect(verifyUserResponse.user).toHaveProperty('userId', UID);
      expect(typeof verifyUserResponse.count).toBe('number');
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('returns 400 wrapper when accessToken undefined', async () => {
      const res = await request(server).post('/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect((res.body as { data: string }).data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns 400 wrapper when accessToken empty', async () => {
      const res = await request(server)
        .post('/auth/refresh')
        .send({ accessToken: '' });

      expect(res.status).toBe(400);
      expect((res.body as { data: string }).data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.REQUIRED,
      );
    });

    it('returns 200 wrapper with new access token (uses issued token)', async () => {
      // Ensure we have an issued token by invoking verifyuser if needed
      if (!issuedToken) {
        const verifyRes = await request(server)
          .post('/auth/verifyuser')
          .send({ idToken: TEST_ID_TOKEN });
        issuedToken = (verifyRes.body as VerifyUserResponse).token;
      }

      const res = await request(server)
        .post('/auth/refresh')
        .send({ accessToken: issuedToken });

      expect(res.status).toBe(200);
      const refreshTokenResponse: RefreshTokenResponse = (
        res.body as { data: RefreshTokenResponse }
      ).data;
      expect(refreshTokenResponse).toHaveProperty('accessToken');
    });
  });

  describe('/auth/logout (POST)', () => {
    it('returns 400 wrapper when accessToken missing', async () => {
      const res = await request(server).post('/auth/logout').send({});

      expect(res.status).toBe(400);
      expect((res.body as { data: string }).data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns 200 wrapper on success (uses refreshed token)', async () => {
      // Ensure we have an issued token
      if (!issuedToken) {
        const verifyRes = await request(server)
          .post('/auth/verifyuser')
          .send({ idToken: TEST_ID_TOKEN });
        issuedToken = (verifyRes.body as VerifyUserResponse).token;
      }

      // Get an access token signed with JWT_ACCESS_SECRET
      const refreshRes = await request(server)
        .post('/auth/refresh')
        .send({ accessToken: issuedToken });

      expect(refreshRes.status).toBe(200);
      const accessToken = (refreshRes.body as { data: RefreshTokenResponse })
        .data.accessToken;

      const res = await request(server)
        .post('/auth/logout')
        .send({ accessToken });

      expect(res.status).toBe(200);
      expect((res.body as { data: string }).data).toBe(
        RESPONSE_STATUS.USER +
          RESPONSE_STATUS.LOGOUT +
          RESPONSE_STATUS.SUCCESSFUL,
      );
    });
  });
});
