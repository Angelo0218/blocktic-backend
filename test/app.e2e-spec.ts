import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * BlockTic E2E 測試 — 測試完整 API 流程。
 *
 * 使用 SQLite in-memory 替代 PostgreSQL，避免依賴外部服務。
 * 外部 API（CompreFace, AWS, ECPay, Polygon）在 dev 模式下會降級跳過。
 */
describe('BlockTic API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, defaultVal?: any) => {
          const overrides: Record<string, any> = {
            DB_HOST: 'localhost',
            DB_PORT: 5432,
            DB_USERNAME: 'blocktic',
            DB_PASSWORD: 'blocktic',
            DB_DATABASE: 'blocktic_test',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            NODE_ENV: 'test',
            JWT_SECRET: 'e2e-test-secret',
            JWT_EXPIRATION: 86400,
            POLYGON_RPC_URL: 'https://rpc-amoy.polygon.technology',
            POLYGON_PRIVATE_KEY: '', // 空值 -> 區塊鏈降級
            SBT_CONTRACT_ADDRESS: '0x' + '0'.repeat(40),
            WALLET_FACTORY_ADDRESS: '0x' + '0'.repeat(40),
            VRF_COORDINATOR_ADDRESS: '0x' + '0'.repeat(40),
            ENTRY_POINT_ADDRESS: '0x' + '0'.repeat(40),
            COMPREFACE_URL: 'http://localhost:8000',
            COMPREFACE_VERIFY_API_KEY: '',
            COMPREFACE_RECOGNIZE_API_KEY: '',
            AWS_ACCESS_KEY_ID: '',
            AWS_SECRET_ACCESS_KEY: '',
            AWS_REGION: 'ap-northeast-1',
            FACE_MATCH_THRESHOLD: 0.85,
            ECPAY_MERCHANT_ID: '3002607',
            ECPAY_HASH_KEY: 'pwFHCqoQZGmho4w6',
            ECPAY_HASH_IV: 'EkRm7iFT261dpevs',
            ECPAY_RETURN_URL: 'http://localhost:3000/tickets/ecpay/callback',
          };
          return overrides[key] ?? defaultVal;
        },
        getOrThrow: (key: string) => {
          const val = {
            JWT_SECRET: 'e2e-test-secret',
            POLYGON_RPC_URL: 'https://rpc-amoy.polygon.technology',
            SBT_CONTRACT_ADDRESS: '0x' + '0'.repeat(40),
            WALLET_FACTORY_ADDRESS: '0x' + '0'.repeat(40),
            VRF_COORDINATOR_ADDRESS: '0x' + '0'.repeat(40),
            ECPAY_MERCHANT_ID: '3002607',
            ECPAY_HASH_KEY: 'pwFHCqoQZGmho4w6',
            ECPAY_HASH_IV: 'EkRm7iFT261dpevs',
            ECPAY_RETURN_URL: 'http://localhost:3000/tickets/ecpay/callback',
          }[key];
          if (!val) throw new Error(`Missing config: ${key}`);
          return val;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // 產生測試 JWT（明確指定 HS256 避免與 gate-verification RS256 衝突）
    jwtService = app.get(JwtService);
    userToken = jwtService.sign(
      { sub: '00000000-0000-0000-0000-000000000001', role: 'user' },
      { secret: 'e2e-test-secret', algorithm: 'HS256' as any },
    );
    adminToken = jwtService.sign(
      { sub: '00000000-0000-0000-0000-000000000099', role: 'admin' },
      { secret: 'e2e-test-secret', algorithm: 'HS256' as any },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Health Check ──────────────────────────────────────

  describe('GET /', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.service).toBe('BlockTic API');
        });
    });
  });

  // ── Auth ──────────────────────────────────────────────

  describe('Auth Guards', () => {
    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .get('/identity/kyc/status/00000000-0000-0000-0000-000000000001')
        .expect(401);
    });

    it('should accept authenticated requests', () => {
      return request(app.getHttpServer())
        .get('/identity/kyc/status/00000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${userToken}`)
        .expect((res) => {
          // 404 是正確的（找不到人），代表 auth 通過了
          expect([200, 404]).toContain(res.status);
        });
    });

    it('should reject non-admin on admin endpoints', () => {
      return request(app.getHttpServer())
        .delete('/identity/00000000-0000-0000-0000-000000000001')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── Identity / KYC ────────────────────────────────────

  describe('POST /identity/kyc', () => {
    it('should reject without consent', () => {
      return request(app.getHttpServer())
        .post('/identity/kyc')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          idCardImage: 'dGVzdA==',
          selfieImage: 'dGVzdA==',
          consent: false,
        })
        .expect(400);
    });

    it('should reject invalid body', () => {
      return request(app.getHttpServer())
        .post('/identity/kyc')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(400);
    });
  });

  // ── Lottery ───────────────────────────────────────────

  describe('Lottery endpoints', () => {
    it('POST /lottery/events/:eventId/register should require auth', () => {
      return request(app.getHttpServer())
        .post('/lottery/events/00000000-0000-0000-0000-000000000010/register')
        .send({ zoneId: 'zone-A', groupSize: 2 })
        .expect(401);
    });

    it('POST /lottery/events/:eventId/draw should require admin', () => {
      return request(app.getHttpServer())
        .post('/lottery/events/00000000-0000-0000-0000-000000000010/draw')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /lottery/events/:eventId/results should be public', () => {
      return request(app.getHttpServer())
        .get('/lottery/events/00000000-0000-0000-0000-000000000010/results')
        .expect(200);
    });
  });

  // ── Ticketing ─────────────────────────────────────────

  describe('Ticketing endpoints', () => {
    it('POST /tickets/events/:eventId/preauth should require auth', () => {
      return request(app.getHttpServer())
        .post('/tickets/events/00000000-0000-0000-0000-000000000010/preauth')
        .send({
          userId: '00000000-0000-0000-0000-000000000001',
          amount: 1500,
          returnUrl: 'http://localhost:5173/callback',
        })
        .expect(401);
    });

    it('POST /tickets/ecpay/callback should not require auth', () => {
      return request(app.getHttpServer())
        .post('/tickets/ecpay/callback')
        .send({ MerchantTradeNo: 'BT000000000000', RtnCode: '1', CheckMacValue: 'INVALID' })
        .expect(200)
        .expect((res) => {
          // CheckMacValue 不對，但端點本身不需要 JWT
          expect(res.text).toContain('CheckMacValue Error');
        });
    });

    it('POST /tickets/:ticketId/capture should require admin', () => {
      return request(app.getHttpServer())
        .post('/tickets/00000000-0000-0000-0000-000000000099/capture')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── Gate Verification ─────────────────────────────────

  describe('Gate verification endpoints', () => {
    it('POST /gate/qr/generate should require auth', () => {
      return request(app.getHttpServer())
        .post('/gate/qr/generate')
        .send({ ticketId: '00000000-0000-0000-0000-000000000001' })
        .expect(401);
    });

    it('POST /gate/verify should require admin', () => {
      return request(app.getHttpServer())
        .post('/gate/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ qrToken: 'fake', gateId: 'gate-1', staffId: 'staff-1' })
        .expect(403);
    });

    it('GET /gate/events/:eventId/stats should require admin', () => {
      return request(app.getHttpServer())
        .get('/gate/events/00000000-0000-0000-0000-000000000010/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ── Seat Allocation ───────────────────────────────────

  describe('Seat allocation endpoints', () => {
    it('POST /seats/events/:eventId/allocate should require admin', () => {
      return request(app.getHttpServer())
        .post('/seats/events/00000000-0000-0000-0000-000000000010/allocate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ zoneId: 'zone-A', groupSize: 2, ticketId: '00000000-0000-0000-0000-000000000001' })
        .expect(403);
    });

    it('GET /seats/events/:eventId/map should require auth', () => {
      return request(app.getHttpServer())
        .get('/seats/events/00000000-0000-0000-0000-000000000010/map')
        .expect(401);
    });
  });

  // ── Validation ────────────────────────────────────────

  describe('Input validation', () => {
    it('should strip unknown fields (whitelist)', () => {
      return request(app.getHttpServer())
        .post('/identity/kyc')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          idCardImage: 'dGVzdA==',
          selfieImage: 'dGVzdA==',
          consent: true,
          maliciousField: 'injected',
        })
        .expect(400); // forbidNonWhitelisted rejects unknown fields
    });

    it('should reject non-UUID path params', () => {
      return request(app.getHttpServer())
        .get('/identity/kyc/status/not-a-uuid')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });
});
