import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';

process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_NAME ??= 'forgeai_auth';
process.env.DB_USER ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
process.env.DB_SCHEMA ??= 'public';
process.env.JWT_ACCESS_SECRET ??= 'forgeai-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'forgeai-refresh-secret';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();

  interface AuthSuccessResponse {
    message: string;
    data: {
      user?: {
        email: string;
      };
      accessToken?: string;
      refreshToken?: string;
    };
  }

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('POST /auth/register creates a user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'a@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
        gender: 'male',
        dateOfBirth: '2000-01-15',
      })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    expect(body.message).toBe('Authentication successful');
    expect(body.data.user?.email).toBe('a@example.com');
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
  });

  it('POST /auth/login returns user and tokens for valid credentials', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      fullName: 'Nguyen Van A',
      email: 'a@example.com',
      password: 'StrongPass123',
      confirmPassword: 'StrongPass123',
      gender: 'male',
      dateOfBirth: '2000-01-15',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'StrongPass123' })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.message).toBe('Authentication successful');
    expect(body.data.user?.email).toBe('a@example.com');
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
  });

  it('GET /auth/me returns current user for valid access token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'a@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
        gender: 'male',
        dateOfBirth: '2000-01-15',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set(
        'Authorization',
        `Bearer ${(registerResponse.body as AuthSuccessResponse).data.accessToken ?? ''}`,
      )
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.message).toBe('Current user fetched successfully');
    expect(body.data.user?.email).toBe('a@example.com');
  });

  it('POST /auth/refresh rotates the refresh token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'a@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
        gender: 'male',
        dateOfBirth: '2000-01-15',
      })
      .expect(201);

    const oldRefreshToken =
      (registerResponse.body as AuthSuccessResponse).data.refreshToken ?? '';
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);
    const body = response.body as AuthSuccessResponse;

    expect(body.message).toBe('Token refreshed successfully');
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).not.toBe(oldRefreshToken);
  });

  it('POST /auth/logout revokes the current refresh token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email: 'a@example.com',
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
        gender: 'male',
        dateOfBirth: '2000-01-15',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken:
          (registerResponse.body as AuthSuccessResponse).data.refreshToken ??
          '',
      })
      .expect(200)
      .expect({ message: 'Logged out successfully' });
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
