import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [latestMetric, completionCount, completionSamples] =
      await Promise.all([
        this.prisma.bodyMetric.findFirst({
          where: { userId },
          orderBy: { recordedAt: 'desc' },
        }),
        this.prisma.workoutCompletion.count({
          where: { userId },
        }),
        this.prisma.workoutCompletion.findMany({
          where: { userId },
          orderBy: { completedAt: 'desc' },
          take: 12,
          select: {
            completedAt: true,
            workout: {
              select: {
                title: true,
                goal: true,
                durationMinutes: true,
                scheduledDays: true,
              },
            },
          },
        }),
      ]);

    const streakDays = this.calculateStreakDays(
      completionSamples.map((entry) => entry.completedAt),
    );
    const dominantGoal = this.resolveDominantGoal(
      completionSamples
        .map((entry) => entry.workout.goal)
        .filter((goal): goal is NonNullable<typeof goal> => goal != null),
    );

    return {
      message: 'Profile fetched successfully',
      data: {
        profile: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth.toISOString(),
          createdAt: user.createdAt.toISOString(),
          athleteAlias: this.buildAthleteAlias(user.fullName),
          athleteTitle: this.resolveAthleteTitle(dominantGoal),
          completionCount,
          streakDays,
          latestMetric: latestMetric
            ? {
                recordedAt: latestMetric.recordedAt.toISOString(),
                weightKg: latestMetric.weightKg,
                heightCm: latestMetric.heightCm,
                bodyFatPct: latestMetric.bodyFatPct,
                muscleMass: latestMetric.muscleMass,
              }
            : null,
          trainingSnapshot: {
            preferredDays: this.resolvePreferredDays(completionSamples),
            preferredDurationMinutes:
              this.resolvePreferredDuration(completionSamples),
            primaryGoal: dominantGoal,
          },
        },
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const emailOwner = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (emailOwner && emailOwner.id !== userId) {
      throw new ConflictException({
        message: 'Validation failed',
        errors: { email: ['Email already exists'] },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: dto.fullName.trim(),
          email: normalizedEmail,
          gender: dto.gender,
          dateOfBirth: new Date(dto.dateOfBirth),
        },
      });

      const hasMetricPayload =
        dto.heightCm != null ||
        dto.weightKg != null ||
        dto.bodyFatPct != null ||
        dto.muscleMass != null;

      if (hasMetricPayload) {
        await tx.bodyMetric.create({
          data: {
            userId,
            heightCm: dto.heightCm ?? null,
            weightKg: dto.weightKg ?? null,
            bodyFatPct: dto.bodyFatPct ?? null,
            muscleMass: dto.muscleMass ?? null,
          },
        });
      }
    });

    return this.getProfile(userId);
  }

  private buildAthleteAlias(fullName: string) {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return 'Athlete';
    }

    return trimmed.split(/\s+/)[0];
  }

  private resolveAthleteTitle(goal: string | null) {
    switch (goal) {
      case 'strength':
        return 'Strength athlete';
      case 'muscle_gain':
        return 'Hypertrophy athlete';
      case 'fat_loss':
        return 'Conditioning athlete';
      case 'mobility':
        return 'Mobility athlete';
      default:
        return 'Hybrid strength athlete';
    }
  }

  private resolveDominantGoal(goals: string[]) {
    if (goals.length === 0) {
      return null;
    }

    const counts = new Map<string, number>();
    for (const goal of goals) {
      counts.set(goal, (counts.get(goal) ?? 0) + 1);
    }

    return [...counts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0][0];
  }

  private resolvePreferredDays(
    completions: Array<{
      workout: { scheduledDays: string[] | null };
    }>,
  ) {
    const counts = new Map<string, number>();

    for (const entry of completions) {
      for (const day of entry.workout.scheduledDays ?? []) {
        counts.set(day, (counts.get(day) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([day]) => day);
  }

  private resolvePreferredDuration(
    completions: Array<{
      workout: { durationMinutes: number | null };
    }>,
  ) {
    const durations = completions
      .map((entry) => entry.workout.durationMinutes)
      .filter((value): value is number => value != null);

    if (durations.length === 0) {
      return null;
    }

    const total = durations.reduce((sum, value) => sum + value, 0);
    return Math.round(total / durations.length);
  }

  private calculateStreakDays(dates: Date[]) {
    if (dates.length === 0) {
      return 0;
    }

    const uniqueDays = Array.from(
      new Set(dates.map((date) => this.startOfUtcDay(date).toISOString())),
    )
      .map((value) => new Date(value))
      .sort((left, right) => right.getTime() - left.getTime());

    let streak = 0;
    let currentDay = this.startOfUtcDay(new Date());

    for (const day of uniqueDays) {
      if (day.getTime() === currentDay.getTime()) {
        streak += 1;
        currentDay = this.subtractUtcDays(currentDay, 1);
        continue;
      }

      if (
        streak === 0 &&
        day.getTime() === this.subtractUtcDays(currentDay, 1).getTime()
      ) {
        streak = 1;
        currentDay = this.subtractUtcDays(day, 1);
        continue;
      }

      break;
    }

    return streak;
  }

  private startOfUtcDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private subtractUtcDays(value: Date, days: number) {
    return new Date(value.getTime() - days * 24 * 60 * 60 * 1000);
  }
}
