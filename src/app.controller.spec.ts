import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('dashboard home', () => {
    it('should return dashboard home summary payload', () => {
      expect(appController.getDashboardHome()).toEqual(
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
  });
});
