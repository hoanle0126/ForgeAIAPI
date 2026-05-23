import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/dashboard/home (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/home')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        data: expect.objectContaining({
          home: expect.objectContaining({
            greetingLine: expect.any(String),
            athleteAlias: expect.any(String),
            readinessScore: expect.any(Number),
            readinessMessage: expect.any(String),
            volumeValue: expect.any(String),
            volumeUnit: expect.any(String),
            streakDays: expect.any(Number),
          }),
        }),
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
