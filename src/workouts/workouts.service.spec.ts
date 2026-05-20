import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { WorkoutsService } from './workouts.service';

describe('WorkoutsService', () => {
  const userId = 'user-1';
  let prisma: {
    exercise: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    workout: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: WorkoutsService;

  beforeEach(() => {
    prisma = {
      exercise: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      workout: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
    };

    service = new WorkoutsService(prisma as never);
  });

  it('creates a personal exercise owned by the current user', async () => {
    const dto: CreateExerciseDto = {
      name: 'Goblet Squat',
      muscleGroups: ['legs', 'core'],
      equipment: 'dumbbell',
      difficulty: 'beginner',
      instructions: ['Hold one dumbbell at chest height', 'Squat with control'],
      safetyNotes: ['Keep your back neutral'],
    };
    prisma.exercise.create.mockResolvedValue({
      id: 'exercise-1',
      ownerId: userId,
      visibility: 'private',
      deletedAt: null,
      ...dto,
    });

    const result = await service.createExercise(userId, dto);

    expect(prisma.exercise.create).toHaveBeenCalledWith({
      data: {
        ...dto,
        visibility: 'private',
        ownerId: userId,
      },
    });
    expect(result.data.exercise.id).toBe('exercise-1');
  });

  it('prevents users from updating global exercises', async () => {
    prisma.exercise.findFirst.mockResolvedValue({
      id: 'exercise-global',
      ownerId: null,
      visibility: 'system',
    });

    await expect(
      service.updateExercise(userId, 'exercise-global', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a workout with ordered exercise snapshots', async () => {
    const dto: CreateWorkoutDto = {
      title: 'First lower body day',
      goal: 'strength',
      status: 'planned',
      items: [
        {
          exerciseId: 'exercise-1',
          order: 1,
          restSeconds: 90,
          sets: [
            { order: 1, reps: 10, weightKg: 24 },
            { order: 2, reps: 10, weightKg: 24 },
            { order: 3, reps: 10, weightKg: 24 },
          ],
        },
      ],
    };
    prisma.exercise.findMany.mockResolvedValue([
      { id: 'exercise-1', name: 'Goblet Squat' },
    ]);
    prisma.workout.create.mockResolvedValue({
      id: 'workout-1',
      userId,
      title: dto.title,
      items: [{ id: 'item-1', exerciseNameSnapshot: 'Goblet Squat' }],
    });

    const result = await service.createWorkout(userId, dto);

    const [createArgs] = prisma.workout.create.mock.calls[0] as [
      {
        data: {
          userId: string;
          title: string;
          items: {
            create: Array<{
              exerciseId?: string;
              exerciseNameSnapshot: string;
              order: number;
              sets: { create: Array<{ order: number; reps?: number }> };
            }>;
          };
        };
        include: object;
      },
    ];

    expect(createArgs.data.userId).toBe(userId);
    expect(createArgs.data.title).toBe(dto.title);
    expect(createArgs.data.items.create[0]).toEqual(
      expect.objectContaining({
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Goblet Squat',
        order: 1,
      }),
    );
    expect(createArgs.data.items.create[0].sets.create).toHaveLength(3);
    expect(result.data.workout.id).toBe('workout-1');
  });

  it('rejects workout items that reference unavailable exercises', async () => {
    prisma.exercise.findMany.mockResolvedValue([]);

    await expect(
      service.createWorkout(userId, {
        title: 'Invalid day',
        items: [
          { exerciseId: 'missing', order: 1, sets: [{ order: 1, reps: 10 }] },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
