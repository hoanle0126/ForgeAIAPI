import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkoutStatus } from '@prisma/client';

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
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    workoutItem: {
      findFirst: jest.Mock;
      count: jest.Mock;
    };
    workoutSet: {
      updateMany: jest.Mock;
      update: jest.Mock;
    };
    workoutCompletion: {
      create: jest.Mock;
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
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      workoutItem: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      workoutSet: {
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      workoutCompletion: {
        create: jest.fn(),
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
      scheduledDays: ['fr', 'mo'],
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
          scheduledDays: string[];
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
    expect(createArgs.data.scheduledDays).toEqual(['mo', 'fr']);
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

  it('marks workout item sets as completed and updates workout status', async () => {
    prisma.workoutItem.findFirst.mockResolvedValue({
      id: 'item-1',
      workoutId: 'workout-1',
      sets: [{ id: 'set-1' }, { id: 'set-2' }],
      workout: {
        status: WorkoutStatus.planned,
        scheduledDays: [],
        updatedAt: new Date('2026-05-23T00:00:00.000Z'),
      },
    });
    prisma.workoutSet.updateMany.mockResolvedValue({ count: 2 });
    prisma.workoutItem.count.mockResolvedValue(0);
    prisma.workout.update.mockResolvedValue({
      status: WorkoutStatus.completed,
    });

    const result = await service.completeWorkoutItem(
      userId,
      'workout-1',
      'item-1',
    );

    expect(prisma.workoutSet.updateMany).toHaveBeenCalledWith({
      where: { workoutItemId: 'item-1' },
      data: { isCompleted: true },
    });
    expect(prisma.workoutItem.count).toHaveBeenCalledWith({
      where: {
        workoutId: 'workout-1',
        sets: { some: { isCompleted: false } },
      },
    });
    expect(prisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { status: WorkoutStatus.completed },
      select: { status: true },
    });
    expect(result.data.workoutStatus).toBe(WorkoutStatus.completed);
    expect(result.data.completedSetCount).toBe(2);
  });

  it('throws not found when workout item is inaccessible', async () => {
    prisma.workoutItem.findFirst.mockResolvedValue(null);

    await expect(
      service.completeWorkoutItem(userId, 'workout-1', 'missing-item'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refreshes completed workout timestamp when finishing completed workout again', async () => {
    prisma.workoutItem.findFirst.mockResolvedValue({
      id: 'item-1',
      workoutId: 'workout-1',
      sets: [{ id: 'set-1' }],
      workout: {
        status: WorkoutStatus.completed,
        scheduledDays: [],
        updatedAt: new Date('2026-05-16T00:00:00.000Z'),
      },
    });
    prisma.workoutSet.updateMany.mockResolvedValue({ count: 1 });
    prisma.workoutItem.count.mockResolvedValue(0);
    prisma.workout.update.mockResolvedValue({
      status: WorkoutStatus.completed,
    });

    await service.completeWorkoutItem(userId, 'workout-1', 'item-1');

    expect(prisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { status: WorkoutStatus.completed },
      select: { status: true },
    });
  });

  it('resets recurring completed workout sets when a new week starts', async () => {
    prisma.workoutItem.findFirst.mockResolvedValue({
      id: 'item-1',
      workoutId: 'workout-1',
      sets: [{ id: 'set-1' }],
      workout: {
        status: WorkoutStatus.completed,
        scheduledDays: ['mo'],
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    });
    prisma.workoutSet.updateMany.mockResolvedValue({ count: 1 });
    prisma.workout.update.mockResolvedValue({ status: WorkoutStatus.planned });
    prisma.workoutItem.count.mockResolvedValue(1);

    await service.completeWorkoutItem(userId, 'workout-1', 'item-1');

    expect(prisma.workoutSet.updateMany).toHaveBeenNthCalledWith(1, {
      where: { workoutItem: { workoutId: 'workout-1' } },
      data: { isCompleted: false },
    });
    expect(prisma.workoutSet.updateMany).toHaveBeenNthCalledWith(2, {
      where: { workoutItemId: 'item-1' },
      data: { isCompleted: true },
    });
    expect(prisma.workout.update).toHaveBeenCalledWith({
      where: { id: 'workout-1' },
      data: { status: WorkoutStatus.planned },
      select: { status: true },
    });
  });

  describe('completeWorkout adaptive adjustment', () => {
    it('should propagate difficulty adjustment to upcoming planned and draft workouts', async () => {
      const activeWorkoutId = 'workout-1';
      const futureWorkoutId = 'workout-future';

      const mockActiveWorkout = {
        id: activeWorkoutId,
        userId,
        difficulty: 'beginner',
        status: WorkoutStatus.planned,
        items: [
          {
            id: 'item-1',
            sets: [
              { id: 'set-1', reps: 10, weightKg: 20, durationSeconds: null },
            ],
          },
        ],
      };

      const mockFutureWorkout = {
        id: futureWorkoutId,
        userId,
        difficulty: 'beginner',
        status: WorkoutStatus.planned,
        items: [
          {
            id: 'item-future-1',
            sets: [
              {
                id: 'set-future-1',
                reps: 8,
                weightKg: 15,
                durationSeconds: null,
              },
            ],
          },
        ],
      };

      prisma.workout.findFirst.mockResolvedValue(mockActiveWorkout);
      prisma.workout.findMany.mockResolvedValue([mockFutureWorkout]);
      prisma.workoutCompletion.create.mockResolvedValue({ id: 'completion-1' });

      await service.completeWorkout(userId, activeWorkoutId, {
        effort: 'just_right',
        difficultyAdjustment: 'increase',
      });

      // Verify active workout set was increased
      expect(prisma.workoutSet.update).toHaveBeenCalledWith({
        where: { id: 'set-1' },
        data: {
          reps: 11,
          weightKg: 22, // 20 * 1.1 = 22 -> rounded is 22. 22 > 20, so stays 22.
          durationSeconds: null,
        },
      });

      // Verify active workout difficulty level was upgraded
      expect(prisma.workout.update).toHaveBeenCalledWith({
        where: { id: activeWorkoutId },
        data: { difficulty: 'intermediate' },
      });

      // Verify future workouts were queried
      expect(prisma.workout.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          id: { not: activeWorkoutId },
          OR: [
            { status: { in: [WorkoutStatus.planned, WorkoutStatus.draft] } },
            { isTemplate: true },
          ],
          deletedAt: null,
        },
        include: {
          items: {
            include: { sets: true },
          },
        },
      });

      // Verify future workout set was adjusted
      expect(prisma.workoutSet.update).toHaveBeenCalledWith({
        where: { id: 'set-future-1' },
        data: {
          reps: 9,
          weightKg: 16.5, // 15 * 1.1 = 16.5 -> rounded is 16.5. 16.5 > 15, so stays 16.5.
          durationSeconds: null,
        },
      });

      // Verify future workout difficulty level was upgraded
      expect(prisma.workout.update).toHaveBeenCalledWith({
        where: { id: futureWorkoutId },
        data: { difficulty: 'intermediate' },
      });
    });
  });
});
