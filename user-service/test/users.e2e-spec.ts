import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  Request,
  ExecutionContext,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { JwtAuthGuard } from '../src/guards/guards';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../src/utility/utility.service';
import { RESPONSE_STATUS } from '../constants';
import { REC_SEQ, REC_STATUS, DATA_STATUS } from '../constants';
import { Server } from 'http';

// Helpers
const AUTH_HEADER = { Authorization: 'Bearer test-token' };
const NO_AUTH_HEADER = {} as Record<string, string>;

// Extend Request to include user for our test guard
interface FirebaseUser {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
}
interface AuthedRequest extends Request {
  user?: FirebaseUser;
}

// Mock guard that simulates Firebase verification and populates req.user when Authorization header is present
class MockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const rawHeader: string | undefined =
      (req.headers['authorization'] as string | undefined) ??
      (req.headers['access_token'] as string | undefined);
    if (!rawHeader) {
      throw new UnauthorizedException('No access token provided');
    }
    req.user = {
      uid: 'test-uid',
      email: 'test@example.com',
      phoneNumber: null,
    };
    return true;
  }
}

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  // Prisma mock with just what we need for tests
  const prismaMock = {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  // UtilityService mock
  const utilityMock = {
    updateEntity: jest.fn(),
  } as unknown as UtilityService;

  const user = {
    userId: 'test-uid',
    firstName: 'John',
    recSeq: REC_SEQ.DEFAULT_RECORD,
    recStatus: REC_STATUS.ACTIVE,
    dataStatus: DATA_STATUS.ACTIVE,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockGuard)
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(UtilityService)
      .useValue(utilityMock)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror production bootstrap
    app.useGlobalPipes(new ValidationPipe());
    app.setGlobalPrefix('user');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /user/profile', () => {
    it('should return 200 and the user when found', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(user);

      const res = await request(app.getHttpServer() as Server)
        .get('/user/profile')
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(user);
    });

    it('should return 404 when user not found', async () => {
      const res = await request(app.getHttpServer() as Server)
        .get('/user/profile')
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.text).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should return 401 when no token provided (guard)', async () => {
      const res = await request(app.getHttpServer() as Server)
        .get('/user/profile')
        .set(NO_AUTH_HEADER);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /user/profile', () => {
    it('should validate DTO and return 400 for invalid dateOfBirth', async () => {
      const payload = { dateOfBirth: 'not-a-date' };
      // Guard passes (auth header provided), but validation should fail before service is called
      const res = await request(app.getHttpServer() as Server)
        .put('/user/profile')
        .set(AUTH_HEADER)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should return 404 when user to update not found', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer() as Server)
        .put('/user/profile')
        .set(AUTH_HEADER)
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(404);
      expect(res.text).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should update the user and return 200 with update status', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce({
        userId: 'test-uid',
      });
      (utilityMock.updateEntity as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { updated: true },
      });

      const res = await request(app.getHttpServer() as Server)
        .put('/user/profile')
        .set(AUTH_HEADER)
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 200, data: { updated: true } });
    });

    it('should return 500 when updateEntity throws', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce({
        userId: 'test-uid',
      });
      (utilityMock.updateEntity as jest.Mock).mockRejectedValueOnce(
        new Error('db error'),
      );

      const res = await request(app.getHttpServer() as Server)
        .put('/user/profile')
        .set(AUTH_HEADER)
        .send({ firstName: 'Jane' });

      expect(res.status).toBe(500);
      expect(res.text).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('DELETE /user/profile', () => {
    it('should return 404 when user to delete not found', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await request(app.getHttpServer() as Server)
        .delete('/user/profile')
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.text).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should delete the user (soft delete) and return 200 with message', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce({
        userId: 'test-uid',
      });
      (prismaMock.users.update as jest.Mock).mockResolvedValueOnce({
        userId: 'test-uid',
        recStatus: 'X',
      });

      const res = await request(app.getHttpServer() as Server)
        .delete('/user/profile')
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.text).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.DELETE,
      );
    });

    it('should return 500 when prisma.update throws', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce({
        userId: 'test-uid',
      });
      (prismaMock.users.update as jest.Mock).mockRejectedValueOnce(
        new Error('db error'),
      );

      const res = await request(app.getHttpServer() as Server)
        .delete('/user/profile')
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.text).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
