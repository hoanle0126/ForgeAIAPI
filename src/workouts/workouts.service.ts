import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Visibility } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { ListWorkoutsQueryDto } from './dto/list-workouts-query.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { WorkoutItemDto } from './dto/workout-item.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async listExercises(userId: string, query: ListExercisesQueryDto) {
    const exercises = await this.prisma.exercise.findMany({
      where: this.buildExerciseWhere(userId, query),
      orderBy: [{ visibility: 'asc' }, { name: 'asc' }],
    });

    return { message: 'Exercises fetched successfully', data: { exercises } };
  }

  async createExercise(userId: string, dto: CreateExerciseDto) {
    const exercise = await this.prisma.exercise.create({
      data: {
        ...this.cleanCreateExerciseData(dto),
        ownerId: userId,
      },
    });

    return { message: 'Exercise created successfully', data: { exercise } };
  }

  async updateExercise(userId: string, id: string, dto: UpdateExerciseDto) {
    const exercise = await this.findAccessibleExercise(userId, id);

    if (exercise.ownerId !== userId) {
      throw new ForbiddenException('Only owned exercises can be modified');
    }

    const updatedExercise = await this.prisma.exercise.update({
      where: { id },
      data: this.cleanUpdateExerciseData(dto),
    });

    return {
      message: 'Exercise updated successfully',
      data: { exercise: updatedExercise },
    };
  }

  async deleteExercise(userId: string, id: string) {
    const exercise = await this.findAccessibleExercise(userId, id);

    if (exercise.ownerId !== userId) {
      throw new ForbiddenException('Only owned exercises can be deleted');
    }

    await this.prisma.exercise.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Exercise deleted successfully' };
  }

  async listWorkouts(userId: string, query: ListWorkoutsQueryDto) {
    const workouts = await this.prisma.workout.findMany({
      where: this.buildWorkoutWhere(userId, query),
      include: {
        items: {
          include: { sets: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
    });

    return { message: 'Workouts fetched successfully', data: { workouts } };
  }

  async getWorkout(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        items: {
          include: { sets: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return { message: 'Workout fetched successfully', data: { workout } };
  }

  async createWorkout(userId: string, dto: CreateWorkoutDto) {
    return this.prisma.$transaction(async (tx) => {
      const items = await this.buildWorkoutItems(userId, dto.items, tx);
      const workout = await tx.workout.create({
        data: {
          ...this.cleanCreateWorkoutData(dto),
          userId,
          items: { create: items },
        },
        include: {
          items: {
            include: { sets: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
      });

      return { message: 'Workout created successfully', data: { workout } };
    });
  }

  async updateWorkout(userId: string, id: string, dto: UpdateWorkoutDto) {
    const existingWorkout = await this.prisma.workout.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existingWorkout) {
      throw new NotFoundException('Workout not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const items = dto.items
        ? await this.buildWorkoutItems(userId, dto.items, tx)
        : null;

      if (items) {
        await tx.workoutItem.deleteMany({ where: { workoutId: id } });
      }

      const workout = await tx.workout.update({
        where: { id },
        data: {
          ...this.cleanWorkoutData(dto),
          ...(items ? { items: { create: items } } : {}),
        },
        include: {
          items: {
            include: { sets: { orderBy: { order: 'asc' } } },
            orderBy: { order: 'asc' },
          },
        },
      });

      return { message: 'Workout updated successfully', data: { workout } };
    });
  }

  async deleteWorkout(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    await this.prisma.workout.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Workout deleted successfully' };
  }

  private buildExerciseWhere(
    userId: string,
    query: ListExercisesQueryDto,
  ): Prisma.ExerciseWhereInput {
    return {
      deletedAt: null,
      OR: [
        { visibility: { in: [Visibility.system, Visibility.public] } },
        { ownerId: userId },
      ],
      ...(query.q
        ? { name: { contains: query.q.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.muscleGroup
        ? { muscleGroups: { has: query.muscleGroup } }
        : {}),
      ...(query.equipment ? { equipment: query.equipment } : {}),
      ...(query.difficulty
        ? {
            difficulty:
              query.difficulty as Prisma.ExerciseWhereInput['difficulty'],
          }
        : {}),
      ...(query.visibility
        ? { visibility: query.visibility as Prisma.ExerciseWhereInput['visibility'] }
        : {}),
    };
  }

  private buildWorkoutWhere(
    userId: string,
    query: ListWorkoutsQueryDto,
  ): Prisma.WorkoutWhereInput {
    return {
      userId,
      deletedAt: null,
      ...(query.isTemplate !== undefined
        ? { isTemplate: query.isTemplate }
        : {}),
      ...(query.status
        ? { status: query.status as Prisma.WorkoutWhereInput['status'] }
        : {}),
      ...(query.from || query.to
        ? {
            scheduledFor: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
  }

  private async findAccessibleExercise(userId: string, id: string) {
    const exercise = await this.prisma.exercise.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { visibility: { in: [Visibility.system, Visibility.public] } },
          { ownerId: userId },
        ],
      },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    return exercise;
  }

  private async buildWorkoutItems(
    userId: string,
    items: WorkoutItemDto[],
    tx: Prisma.TransactionClient,
  ) {
    this.validateWorkoutItems(items);

    const exerciseIds = items
      .map((item) => item.exerciseId)
      .filter((id): id is string => Boolean(id));
    const exercises = exerciseIds.length
      ? await tx.exercise.findMany({
          where: {
            id: { in: exerciseIds },
            deletedAt: null,
            OR: [
              { visibility: { in: [Visibility.system, Visibility.public] } },
              { ownerId: userId },
            ],
          },
          select: { id: true, name: true },
        })
      : [];
    const exercisesById = new Map(
      exercises.map((exercise) => [exercise.id, exercise.name]),
    );

    return items.map((item) => {
      const exerciseName = item.exerciseId
        ? exercisesById.get(item.exerciseId)
        : item.exerciseName?.trim();

      if (!exerciseName) {
        throw new NotFoundException('Workout item exercise not found');
      }

      return {
        exerciseId: item.exerciseId,
        exerciseNameSnapshot: exerciseName,
        order: item.order,
        restSeconds: item.restSeconds,
        notes: item.notes?.trim(),
        sets: {
          create: item.sets.map((set) => ({
            order: set.order,
            reps: set.reps,
            weightKg: set.weightKg,
            durationSeconds: set.durationSeconds,
            restSeconds: set.restSeconds,
            isCompleted: set.isCompleted ?? false,
          })),
        },
      };
    });
  }

  private validateWorkoutItems(items: WorkoutItemDto[]) {
    const orders = new Set<number>();

    for (const item of items) {
      if (orders.has(item.order)) {
        throw new BadRequestException(
          'Workout item order values must be unique',
        );
      }

      orders.add(item.order);

      if (!item.exerciseId && !item.exerciseName?.trim()) {
        throw new BadRequestException(
          'Workout item must include exerciseId or exerciseName',
        );
      }

      this.validateWorkoutSetItems(item.sets);
    }
  }

  private validateWorkoutSetItems(sets: WorkoutItemDto['sets']) {
    const orders = new Set<number>();

    for (const set of sets) {
      if (orders.has(set.order)) {
        throw new BadRequestException('Workout set order values must be unique');
      }

      orders.add(set.order);

      if (!set.durationSeconds && !set.reps) {
        throw new BadRequestException(
          'Workout set must include either durationSeconds or reps',
        );
      }
    }
  }

  private cleanCreateExerciseData(dto: CreateExerciseDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim(),
      muscleGroups: dto.muscleGroups,
      equipment: dto.equipment,
      difficulty: dto.difficulty,
      instructions: dto.instructions ?? [],
      safetyNotes: dto.safetyNotes ?? [],
      videoUrl: dto.videoUrl,
      imageUrl: dto.imageUrl,
      visibility: dto.visibility ?? Visibility.private,
    };
  }

  private cleanUpdateExerciseData(dto: UpdateExerciseDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.muscleGroups !== undefined
        ? { muscleGroups: dto.muscleGroups }
        : {}),
      ...(dto.equipment !== undefined ? { equipment: dto.equipment } : {}),
      ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
      ...(dto.instructions !== undefined
        ? { instructions: dto.instructions }
        : {}),
      ...(dto.safetyNotes !== undefined
        ? { safetyNotes: dto.safetyNotes }
        : {}),
      ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
    };
  }

  private cleanWorkoutData(dto: UpdateWorkoutDto) {
    return {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() }
        : {}),
      ...(dto.isTemplate !== undefined ? { isTemplate: dto.isTemplate } : {}),
      ...(dto.scheduledFor !== undefined
        ? { scheduledFor: dto.scheduledFor }
        : {}),
      ...(dto.durationMinutes !== undefined
        ? { durationMinutes: dto.durationMinutes }
        : {}),
      ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
      ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
    };
  }

  private cleanCreateWorkoutData(dto: CreateWorkoutDto) {
    return {
      title: dto.title.trim(),
      description: dto.description?.trim(),
      isTemplate: dto.isTemplate ?? false,
      scheduledFor: dto.scheduledFor,
      durationMinutes: dto.durationMinutes,
      difficulty: dto.difficulty,
      goal: dto.goal,
      status: dto.status,
      notes: dto.notes?.trim(),
    };
  }
}
