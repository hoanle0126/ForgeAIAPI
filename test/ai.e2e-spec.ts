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

describe('AI workout builder API (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();

  interface AuthSuccessResponse {
    data: {
      accessToken?: string;
    };
  }

  interface WorkoutBuilderPreviewResponse {
    message: string;
    data: {
      plan: {
        goal: string;
        preferredTime: string;
        selectedTrainingDays: string[];
        autoRecoveryInserted: boolean;
        exercises: unknown[];
        schedule: Array<{
          type: string;
        }>;
      };
      workoutDraft: {
        isTemplate: boolean;
        goal: string;
        status: string;
        items: Array<{
          exerciseName: string;
          sets: Array<{
            order: number;
          }>;
        }>;
      };
    };
  }

  interface MonthlyWorkoutPlanResponse {
    message: string;
    data: {
      plan: {
        blockLengthWeeks: number;
        selectedTrainingDays: string[];
        templateWorkouts: unknown[];
        weeks: Array<{
          weekNumber: number;
          days: Array<{
            type: string;
            templateId: string | null;
          }>;
        }>;
        reassessment: {
          dueAfterDays: number;
        };
      };
      workoutTemplateDrafts: Array<{
        title: string;
        isTemplate: boolean;
      }>;
    };
  }

  beforeEach(async () => {
    await prisma.workoutSet.deleteMany();
    await prisma.workoutItem.deleteMany();
    await prisma.workout.deleteMany();
    await prisma.exercise.deleteMany();
    await prisma.bodyMetric.deleteMany();
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

  it('generates an authenticated AI workout preview with a saveable draft', async () => {
    const accessToken = await registerAndGetAccessToken('ai-user@example.com');

    const response = await request(app.getHttpServer())
      .post('/ai/workout-builder/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        goal: 'muscle_gain',
        equipment: ['bodyweight', 'dumbbell', 'band'],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'very_active',
        trainingDays: ['mo', 'we', 'fr'],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(201);
    const body = response.body as WorkoutBuilderPreviewResponse;

    expect(body.message).toBe('AI workout plan preview generated successfully');
    expect(body.data.plan.goal).toBe('muscle_gain');
    expect(body.data.plan.preferredTime).toBe('evening');
    expect(body.data.plan.selectedTrainingDays).toEqual(['mo', 'we', 'fr']);
    expect(body.data.plan.exercises.length).toBeGreaterThanOrEqual(3);
    expect(body.data.plan.schedule).toHaveLength(7);
    expect(body.data.workoutDraft).toEqual(
      expect.objectContaining({
        isTemplate: true,
        goal: 'muscle_gain',
        status: 'planned',
      }),
    );
    expect(body.data.workoutDraft.items[0].exerciseName).toBeTruthy();
    expect(body.data.workoutDraft.items[0].sets[0].order).toBe(1);
  });

  it('keeps one recovery day when all seven days are selected', async () => {
    const accessToken = await registerAndGetAccessToken(
      'seven-days@example.com',
    );

    const response = await request(app.getHttpServer())
      .post('/ai/workout-builder/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        goal: 'fat_loss',
        equipment: ['bodyweight', 'band'],
        heightCm: 175,
        weightKg: 70,
        age: 25,
        activityLevel: 'active',
        trainingDays: ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'],
        sessionMinutes: 30,
        preferredTime: 'morning',
      })
      .expect(201);
    const body = response.body as WorkoutBuilderPreviewResponse;

    expect(body.data.plan.autoRecoveryInserted).toBe(true);
    expect(
      body.data.plan.schedule.filter((item) => item.type === 'recovery').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid workout builder payloads', async () => {
    const accessToken = await registerAndGetAccessToken(
      'invalid-ai@example.com',
    );

    await request(app.getHttpServer())
      .post('/ai/workout-builder/preview')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        goal: 'muscle_gain',
        equipment: [],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'active',
        trainingDays: ['mo'],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(400);
  });

  it('generates a 4-week monthly workout plan for selected training frequency', async () => {
    const accessToken = await registerAndGetAccessToken(
      'monthly-ai@example.com',
    );

    const response = await request(app.getHttpServer())
      .post('/ai/workout-builder/monthly-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        goal: 'muscle_gain',
        equipment: ['bodyweight', 'dumbbell', 'band'],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'very_active',
        trainingDays: ['mo', 'we', 'fr'],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(201);
    const body = response.body as MonthlyWorkoutPlanResponse;

    expect(body.message).toBe('AI monthly workout plan generated successfully');
    expect(body.data.plan.blockLengthWeeks).toBe(4);
    expect(body.data.plan.selectedTrainingDays).toEqual(['mo', 'we', 'fr']);
    expect(body.data.plan.templateWorkouts).toHaveLength(3);
    expect(body.data.plan.weeks).toHaveLength(4);
    expect(body.data.plan.weeks[0].days).toHaveLength(7);
    expect(body.data.plan.reassessment.dueAfterDays).toBe(28);
    expect(body.data.workoutTemplateDrafts).toHaveLength(3);
    expect(body.data.workoutTemplateDrafts[0]).toEqual(
      expect.objectContaining({
        isTemplate: true,
      }),
    );
  });

  it('rejects monthly planning with empty training days', async () => {
    const accessToken = await registerAndGetAccessToken(
      'monthly-invalid@example.com',
    );

    await request(app.getHttpServer())
      .post('/ai/workout-builder/monthly-plan')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        goal: 'muscle_gain',
        equipment: ['bodyweight', 'dumbbell'],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'very_active',
        trainingDays: [],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(400);
  });

  it('requires authentication for AI workout builder preview', async () => {
    await request(app.getHttpServer())
      .post('/ai/workout-builder/preview')
      .send({
        goal: 'muscle_gain',
        equipment: ['bodyweight'],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'active',
        trainingDays: ['mo'],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(401);
  });

  it('requires authentication for monthly workout builder planning', async () => {
    await request(app.getHttpServer())
      .post('/ai/workout-builder/monthly-plan')
      .send({
        goal: 'muscle_gain',
        equipment: ['bodyweight'],
        heightCm: 180,
        weightKg: 82,
        age: 29,
        activityLevel: 'active',
        trainingDays: ['mo', 'tu', 'th', 'sa'],
        sessionMinutes: 45,
        preferredTime: 'evening',
      })
      .expect(401);
  });

  async function registerAndGetAccessToken(email: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Nguyen Van A',
        email,
        password: 'StrongPass123',
        confirmPassword: 'StrongPass123',
        gender: 'male',
        dateOfBirth: '2000-01-15',
      })
      .expect(201);
    const body = response.body as AuthSuccessResponse;

    return body.data.accessToken ?? '';
  }

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
