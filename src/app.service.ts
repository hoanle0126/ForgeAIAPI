import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getDashboardHome(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const completedWorkouts = await this.prisma.workoutCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: {
        completedAt: true,
        durationSeconds: true,
        workout: {
          select: {
            items: {
              select: {
                sets: {
                  select: { reps: true, weightKg: true, durationSeconds: true },
                },
              },
            },
          },
        },
      },
      take: 30,
    });

    const readinessScore = this.buildReadinessScore(completedWorkouts.length);
    const totalVolumeKg = this.calculateTotalVolumeKg(completedWorkouts);
    const streakDays = this.calculateStreakDays(completedWorkouts);

    return {
      message: 'Dashboard home summary fetched successfully',
      data: {
        home: {
          greetingLine: this.buildGreetingLine(),
          athleteAlias: this.buildAthleteAlias(user.fullName),
          readinessScore,
          readinessMessage: this.buildReadinessMessage(
            readinessScore,
            completedWorkouts.length,
          ),
          volumeValue: this.formatVolumeValue(totalVolumeKg),
          volumeUnit: 'kg lifted',
          streakDays,
        },
      },
    };
  }

  private buildGreetingLine(): string {
    const currentHour = new Date().getHours();

    if (currentHour < 12) {
      return 'Good morning';
    }
    if (currentHour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  private buildAthleteAlias(fullName: string) {
    const trimmed = fullName.trim();
    if (trimmed.length === 0) {
      return 'Athlete';
    }

    return trimmed.split(/\s+/)[0];
  }

  private buildReadinessScore(completedWorkoutCount: number) {
    if (completedWorkoutCount >= 8) {
      return 84;
    }
    if (completedWorkoutCount >= 4) {
      return 78;
    }
    if (completedWorkoutCount >= 1) {
      return 72;
    }
    return 66;
  }

  private buildReadinessMessage(
    readinessScore: number,
    completedWorkoutCount: number,
  ) {
    if (completedWorkoutCount == 0) {
      return 'Complete your first workout to unlock a cleaner readiness baseline.';
    }
    if (readinessScore >= 82) {
      return 'Backend synced. Your recent consistency supports a full training day.';
    }
    if (readinessScore >= 75) {
      return 'Backend synced. Recovery-adjusted training is ready for today.';
    }
    return 'Backend synced. Keep today controlled and rebuild consistency.';
  }

  private calculateTotalVolumeKg(
    completions: Array<{
      workout: {
        items: Array<{
          sets: Array<{
            reps: number | null;
            weightKg: number | null;
            durationSeconds: number | null;
          }>;
        }>;
      };
    }>,
  ) {
    return completions.reduce((total, completion) => {
      const workoutVolume = completion.workout.items.reduce(
        (itemTotal, item) => {
          const itemVolume = item.sets.reduce((setTotal, set) => {
            if (set.reps == null || set.weightKg == null) {
              return setTotal;
            }

            return setTotal + set.reps * set.weightKg;
          }, 0);

          return itemTotal + itemVolume;
        },
        0,
      );

      return total + workoutVolume;
    }, 0);
  }

  private formatVolumeValue(totalVolumeKg: number) {
    if (totalVolumeKg >= 1000) {
      return `${(totalVolumeKg / 1000).toFixed(1)}k`;
    }

    return totalVolumeKg.toFixed(totalVolumeKg === 0 ? 0 : 1);
  }

  private calculateStreakDays(completions: Array<{ completedAt: Date }>) {
    if (completions.length === 0) {
      return 0;
    }

    const uniqueDays = Array.from(
      new Set(
        completions.map((entry) =>
          this.startOfUtcDay(entry.completedAt).toISOString(),
        ),
      ),
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
