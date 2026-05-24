import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  const prismaServiceMock = {
    user: { findUnique: jest.fn() },
    workoutCompletion: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
    prismaServiceMock.user.findUnique.mockReset();
    prismaServiceMock.workoutCompletion.findMany.mockReset();
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('dashboard home', () => {
    it('should return dashboard home summary payload', async () => {
      prismaServiceMock.user.findUnique.mockResolvedValue({
        fullName: 'Alex Morgan',
      });
      prismaServiceMock.workoutCompletion.findMany.mockResolvedValue([]);

      jest
        .spyOn(appService, 'getDashboardHome')
        .mockResolvedValueOnce(await appService.getDashboardHome('user-1'));

      const result = await appController.getDashboardHome({
        user: { sub: 'user-1' },
      });

      expect(result.message).toEqual(expect.any(String));
      expect(result.data.home.greetingLine).toEqual(expect.any(String));
      expect(result.data.home.athleteAlias).toEqual(expect.any(String));
      expect(result.data.home.readinessScore).toEqual(expect.any(Number));
      expect(result.data.home.readinessMessage).toEqual(expect.any(String));
      expect(result.data.home.volumeValue).toEqual(expect.any(String));
      expect(result.data.home.volumeUnit).toEqual(expect.any(String));
      expect(result.data.home.streakDays).toEqual(expect.any(Number));
    });
  });
});
