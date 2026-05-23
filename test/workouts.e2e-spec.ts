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

describe('Workouts API (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient();

  interface AuthSuccessResponse {
    data: {
      accessToken?: string;
    };
  }

  interface ExerciseResponse {
    data: {
      exercise: {
        id: string;
        name: string;
        ownerId: string;
        visibility: string;
      };
    };
  }

  interface WorkoutResponse {
    data: {
      workout: {
        id: string;
        status: string;
        title: string;
        items: Array<{
          id: string;
          exerciseNameSnapshot: string;
          sets: Array<{
            id: string;
            reps: number;
            restSeconds: number;
            isCompleted: boolean;
          }>;
        }>;
      };
    };
  }

  beforeEach(async () => {
    await prisma.workoutItem.deleteMany();
    await prisma.workout.deleteMany();
    await prisma.exercise.deleteMany();
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

  it('creates an exercise and a workout through authenticated API calls', async () => {
    const accessToken = await registerAndGetAccessToken('owner@example.com');

    const exerciseResponse = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Goblet Squat',
        muscleGroups: ['legs', 'core'],
        equipment: 'dumbbell',
        difficulty: 'beginner',
        instructions: ['Hold a dumbbell at chest height', 'Squat down slowly'],
        safetyNotes: ['Keep your back neutral'],
      })
      .expect(201);
    const exerciseBody = exerciseResponse.body as ExerciseResponse;

    expect(exerciseBody.data.exercise.name).toBe('Goblet Squat');
    expect(exerciseBody.data.exercise.visibility).toBe('private');

    const workoutResponse = await request(app.getHttpServer())
      .post('/workouts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Lower Body Starter',
        goal: 'strength',
        status: 'planned',
        items: [
          {
            exerciseId: exerciseBody.data.exercise.id,
            order: 1,
            restSeconds: 90,
            sets: [
              {
                order: 1,
                reps: 10,
                restSeconds: 90,
              },
              {
                order: 2,
                reps: 10,
                restSeconds: 90,
              },
              {
                order: 3,
                reps: 10,
                restSeconds: 90,
              },
            ],
          },
        ],
      })
      .expect(201);
    const workoutBody = workoutResponse.body as WorkoutResponse;

    expect(workoutBody.data.workout.title).toBe('Lower Body Starter');
    expect(workoutBody.data.workout.items[0]).toEqual(
      expect.objectContaining({
        exerciseNameSnapshot: 'Goblet Squat',
      }),
    );
    expect(workoutBody.data.workout.items[0].sets).toHaveLength(3);
    expect(workoutBody.data.workout.items[0].sets[0]).toEqual(
      expect.objectContaining({
        reps: 10,
        restSeconds: 90,
      }),
    );

    const workoutId = workoutBody.data.workout.id;
    const workoutItemId = workoutBody.data.workout.items[0].id;
    await request(app.getHttpServer())
      .patch(`/workouts/${workoutId}/items/${workoutItemId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const refreshedWorkoutResponse = await request(app.getHttpServer())
      .get(`/workouts/${workoutId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const refreshedWorkoutBody =
      refreshedWorkoutResponse.body as WorkoutResponse;

    expect(refreshedWorkoutBody.data.workout.status).toBe('completed');
    expect(
      refreshedWorkoutBody.data.workout.items[0].sets.every(
        (set) => set.isCompleted,
      ),
    ).toBe(true);
  });

  it('rejects workout creation with another user personal exercise', async () => {
    const ownerToken = await registerAndGetAccessToken('owner@example.com');
    const otherToken = await registerAndGetAccessToken('other@example.com');
    const exerciseResponse = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Private Dumbbell Row',
        muscleGroups: ['back'],
        equipment: 'dumbbell',
        difficulty: 'beginner',
      })
      .expect(201);
    const exerciseBody = exerciseResponse.body as ExerciseResponse;

    await request(app.getHttpServer())
      .post('/workouts')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        title: 'Should Fail',
        items: [
          {
            exerciseId: exerciseBody.data.exercise.id,
            order: 1,
            sets: [
              {
                order: 1,
                reps: 10,
              },
            ],
          },
        ],
      })
      .expect(404);
  });

  it('requires authentication for workout endpoints', async () => {
    await request(app.getHttpServer()).get('/workouts').expect(401);
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
