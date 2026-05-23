import { Injectable, Logger } from '@nestjs/common';
import { Visibility } from '@prisma/client';

import { BuildMonthlyWorkoutPlanDto } from './dto/build-monthly-workout-plan.dto';
import {
  AiPreferredTime,
  AiTrainingDay,
  BuildWorkoutPlanDto,
} from './dto/build-workout-plan.dto';
import {
  ModelAiInsightChatReply,
  ModelAiMonthlyWorkoutPlan,
  ModelAiRunnerService,
  ModelAiWorkoutTemplate,
  ModelAiWorkoutPlan,
} from './model-ai-runner.service';
import { InsightChatDto } from './dto/insight-chat.dto';
import {
  buildInsightChatReply,
  buildInsightOverview,
  type InsightOverview,
  type InsightWorkout,
} from './insight-engine';
import { PrismaService } from '../prisma/prisma.service';

const weekOrder: AiTrainingDay[] = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

const dayLabels: Record<AiTrainingDay, string> = {
  mo: 'Monday',
  tu: 'Tuesday',
  we: 'Wednesday',
  th: 'Thursday',
  fr: 'Friday',
  sa: 'Saturday',
  su: 'Sunday',
};

const preferredTimeLabels: Record<AiPreferredTime, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  flexible: 'Flexible',
};

const goalLabels: Record<BuildWorkoutPlanDto['goal'], string> = {
  fat_loss: 'Fat Loss',
  muscle_gain: 'Muscle Gain',
  strength: 'Strength',
  mobility: 'Mobility',
  general_fitness: 'General Fitness',
};

const equipmentKeysByLabel: Record<string, string> = {
  'Body Only': 'bodyweight',
  Dumbbell: 'dumbbell',
  Barbell: 'barbell',
  Machine: 'machine',
  Cable: 'cable',
  Bands: 'band',
  Kettlebells: 'kettlebell',
  Other: 'other',
};

type WorkoutDraftSetTemplate = {
  reps?: number;
  durationSeconds?: number;
  restSeconds?: number;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelAiRunner: ModelAiRunnerService,
  ) {}

  async getExerciseDataset() {
    const exercises = await this.prisma.exercise.findMany({
      where: {
        deletedAt: null,
        visibility: { in: [Visibility.public, Visibility.system] },
      },
      orderBy: [{ visibility: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        muscleGroups: true,
        equipment: true,
        difficulty: true,
        instructions: true,
        safetyNotes: true,
        visibility: true,
      },
    });

    return {
      message: 'AI exercise dataset fetched successfully',
      data: { exercises },
    };
  }

  async getInsightsOverview(userId: string) {
    const overview = await this.buildInsightsOverview(userId);

    return {
      message: 'AI insights overview fetched successfully',
      data: { overview },
    };
  }

  async sendInsightChatMessage(userId: string, dto: InsightChatDto) {
    const prompt = dto.prompt.trim();
    const overview = await this.buildInsightsOverview(userId);
    const selectedAnalysis = this.resolveInsightMuscleAnalysis(
      overview,
      dto.muscleId,
    );
    const fallbackReply = buildInsightChatReply({
      prompt,
      selectedMuscleId: selectedAnalysis.muscleId,
      overview,
    });
    let reply = fallbackReply;

    try {
      const modelReply = await this.modelAiRunner.buildInsightChatReply({
        prompt,
        selected_muscle_id: selectedAnalysis.muscleId,
        selected_muscle_name: selectedAnalysis.displayName,
        selected_status: selectedAnalysis.status,
        selected_trend_percent: this.normalizeInsightNumber(
          selectedAnalysis.trendPercent,
        ),
        selected_fatigue_score: this.normalizeInsightNumber(
          selectedAnalysis.fatigueScore,
        ),
        selected_recommendation: selectedAnalysis.recommendation,
        selected_top_exercises: selectedAnalysis.exerciseContributions
          .slice(0, 4)
          .map((entry) => entry.exerciseName),
        high_load_muscles: overview.muscleAnalyses
          .filter((analysis) => analysis.status === 'overloaded')
          .map((analysis) => analysis.displayName)
          .slice(0, 4),
        recovered_muscles: overview.muscleAnalyses
          .filter((analysis) => analysis.status === 'recovered')
          .map((analysis) => analysis.displayName)
          .slice(0, 4),
      });
      reply = this.buildInsightReplyFromModelResponse(
        modelReply,
        fallbackReply,
      );
    } catch (error) {
      this.logger.warn(
        `Insight chat fallback used because model_ai failed: ${(error as Error).message}`,
      );
    }

    return {
      message: 'AI insight chat response generated successfully',
      data: { reply },
    };
  }

  private resolveInsightMuscleAnalysis(
    overview: InsightOverview,
    requestedMuscleId?: string,
  ): InsightOverview['muscleAnalyses'][number] {
    return (
      overview.muscleAnalyses.find(
        (analysis) => analysis.muscleId === requestedMuscleId,
      ) ??
      overview.muscleAnalyses.find(
        (analysis) => analysis.muscleId === overview.selectedMuscleId,
      ) ??
      overview.muscleAnalyses[0] ?? {
        muscleId: requestedMuscleId ?? overview.selectedMuscleId,
        displayName: 'Unknown muscle',
        status: 'neutral',
        volume: 0,
        rpe: 0,
        trendPercent: 0,
        fatigueScore: 0,
        recommendation: 'No analysis is available for this muscle yet.',
        loadTrend: [],
        exerciseContributions: [],
        recoveryBalance: [],
      }
    );
  }

  private buildInsightReplyFromModelResponse(
    modelReply: ModelAiInsightChatReply,
    fallbackReply: ReturnType<typeof buildInsightChatReply>,
  ) {
    const content = modelReply.content.trim();
    if (!content) {
      return fallbackReply;
    }

    return {
      id: new Date().toISOString(),
      content,
      isUser: false,
      hasChart: modelReply.has_chart ?? true,
    };
  }

  private normalizeInsightNumber(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(2));
  }

  async buildWorkoutPlanPreview(
    dto: BuildWorkoutPlanDto,
  ): Promise<{ message: string; data: unknown }> {
    const normalizedTrainingDays = this.normalizeTrainingDays(dto.trainingDays);
    const effectiveTrainingDays = Math.min(normalizedTrainingDays.length, 6);
    const coachPlan = await this.modelAiRunner.buildWorkoutPlan({
      goal: dto.goal,
      equipment: dto.equipment,
      height_cm: Math.round(dto.heightCm),
      weight_kg: Math.round(dto.weightKg),
      age: dto.age,
      activity_level: dto.activityLevel,
      training_days_per_week: effectiveTrainingDays,
      session_minutes: dto.sessionMinutes,
      experience_level: dto.experienceLevel ?? 'beginner',
      injuries: dto.injuries,
      feedback: dto.feedback
        ? {
            missed_workouts: dto.feedback.missedWorkouts,
            fatigue_level: dto.feedback.fatigueLevel,
            soreness_areas: dto.feedback.sorenessAreas,
            completed_workouts: dto.feedback.completedWorkouts,
          }
        : undefined,
    });
    const previewExercises = this.buildPreviewExercises(
      coachPlan,
      dto.sessionMinutes,
    );
    const autoRecoveryInserted =
      normalizedTrainingDays.length > effectiveTrainingDays;
    const coachNotes = autoRecoveryInserted
      ? [
          ...coachPlan.coach_notes,
          'All 7 days were selected, so ForgeAI kept one recovery day to stay beginner-safe.',
        ]
      : coachPlan.coach_notes;
    const title = this.buildWorkoutTitle(dto.goal, previewExercises);

    return {
      message: 'AI workout plan preview generated successfully',
      data: {
        plan: {
          title,
          goal: dto.goal,
          modelGoal: coachPlan.goal_slug,
          modelVersion: coachPlan.model_version,
          sessionMinutes: dto.sessionMinutes,
          preferredTime: dto.preferredTime,
          preferredTimeLabel: preferredTimeLabels[dto.preferredTime],
          selectedTrainingDays: normalizedTrainingDays,
          effectiveTrainingDaysPerWeek: effectiveTrainingDays,
          autoRecoveryInserted,
          summary: coachPlan.coach_summary,
          safetyNotes: coachPlan.safety_notes,
          coachNotes,
          readinessAdjustment: coachPlan.readiness_adjustment,
          progressionPlan: coachPlan.progression_plan,
          exercises: previewExercises,
          schedule: this.buildWeeklySchedule(
            normalizedTrainingDays,
            effectiveTrainingDays,
            dto.preferredTime,
            coachPlan,
          ),
        },
        workoutDraft: this.buildWorkoutDraft(
          dto,
          coachPlan,
          previewExercises,
          title,
          normalizedTrainingDays,
          effectiveTrainingDays,
        ),
      },
    };
  }

  async buildMonthlyWorkoutPlan(
    dto: BuildMonthlyWorkoutPlanDto,
  ): Promise<{ message: string; data: unknown }> {
    const normalizedTrainingDays = this.normalizeTrainingDays(dto.trainingDays);

    const coachPlan = await this.modelAiRunner.buildMonthlyWorkoutPlan({
      goal: dto.goal,
      equipment: dto.equipment,
      height_cm: Math.round(dto.heightCm),
      weight_kg: Math.round(dto.weightKg),
      age: dto.age,
      activity_level: dto.activityLevel,
      training_days_per_week: normalizedTrainingDays.length,
      session_minutes: dto.sessionMinutes,
      experience_level: dto.experienceLevel ?? 'beginner',
      injuries: dto.injuries,
      feedback: dto.feedback
        ? {
            missed_workouts: dto.feedback.missedWorkouts,
            fatigue_level: dto.feedback.fatigueLevel,
            soreness_areas: dto.feedback.sorenessAreas,
            completed_workouts: dto.feedback.completedWorkouts,
          }
        : undefined,
    });

    const templateWorkouts = coachPlan.workout_templates.map((template) =>
      this.buildMonthlyTemplateView(template),
    );
    const templateScheduledDays = this.distributeTemplateScheduledDays(
      normalizedTrainingDays,
      coachPlan.workout_templates.length,
    );

    return {
      message: 'AI monthly workout plan generated successfully',
      data: {
        plan: {
          title: `${goalLabels[dto.goal]} Month 1 Block`,
          goal: dto.goal,
          modelGoal: coachPlan.goal_slug,
          modelVersion: coachPlan.model_version,
          blockLengthWeeks: coachPlan.block_length_weeks,
          selectedTrainingDays: normalizedTrainingDays,
          preferredTime: dto.preferredTime,
          preferredTimeLabel: preferredTimeLabels[dto.preferredTime],
          summary: coachPlan.coach_summary,
          safetyNotes: coachPlan.safety_notes,
          coachNotes: coachPlan.coach_notes,
          readinessAdjustment: coachPlan.readiness_adjustment,
          progressionPlan: coachPlan.progression_plan,
          templateWorkouts,
          weeks: this.buildMonthlyWeeks(
            normalizedTrainingDays,
            dto.preferredTime,
            coachPlan,
            templateWorkouts,
          ),
          reassessment: {
            dueAfterDays: coachPlan.reassessment.due_after_days,
            promptTitle: coachPlan.reassessment.prompt_title,
            summary: coachPlan.reassessment.summary,
            questions: coachPlan.reassessment.questions,
          },
        },
        workoutTemplateDrafts: coachPlan.workout_templates.map(
          (template, index) =>
            this.buildWorkoutTemplateDraft(
              dto,
              coachPlan,
              template,
              templateScheduledDays[index] ?? [],
            ),
        ),
      },
    };
  }

  private buildPreviewExercises(
    coachPlan: ModelAiWorkoutPlan,
    sessionMinutes: number,
  ) {
    const exerciseCount = this.resolveExerciseCount(sessionMinutes);

    return coachPlan.workouts.slice(0, exerciseCount).map((workout, index) => ({
      order: index + 1,
      title: workout.title,
      bodyPart: workout.body_part,
      equipment: workout.equipment,
      equipmentKey: equipmentKeysByLabel[workout.equipment] ?? 'other',
      level: workout.level,
      type: workout.type,
      description: workout.desc,
      sets: workout.sets,
      reps: workout.reps,
      restSeconds: workout.rest_seconds,
      confidence: workout.confidence,
      modelScore: workout.model_score,
      rationale: workout.rationale,
      prescriptionLabel: `${workout.sets} sets x ${workout.reps}`,
      substitutions: workout.substitutions.map((item) => ({
        title: item.title,
        equipment: item.equipment,
        equipmentKey: equipmentKeysByLabel[item.equipment] ?? 'other',
        level: item.level,
        reason: item.reason,
      })),
    }));
  }

  private buildMonthlyTemplateView(template: ModelAiWorkoutTemplate) {
    return {
      templateId: template.template_id,
      title: template.title,
      focus: template.focus,
      estimatedMinutes: template.estimated_minutes,
      warmUp: template.warm_up,
      cooldown: template.cooldown,
      exercises: template.exercises.map((exercise, index) => ({
        order: index + 1,
        title: exercise.title,
        bodyPart: exercise.body_part,
        equipment: exercise.equipment,
        equipmentKey: equipmentKeysByLabel[exercise.equipment] ?? 'other',
        level: exercise.level,
        type: exercise.type,
        description: exercise.desc,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.rest_seconds,
        confidence: exercise.confidence,
        modelScore: exercise.model_score,
        rationale: exercise.rationale,
        prescriptionLabel: `${exercise.sets} sets x ${exercise.reps}`,
        substitutions: exercise.substitutions.map((item) => ({
          title: item.title,
          equipment: item.equipment,
          equipmentKey: equipmentKeysByLabel[item.equipment] ?? 'other',
          level: item.level,
          reason: item.reason,
        })),
      })),
    };
  }

  private buildWeeklySchedule(
    selectedTrainingDays: AiTrainingDay[],
    effectiveTrainingDays: number,
    preferredTime: AiPreferredTime,
    coachPlan: ModelAiWorkoutPlan,
  ) {
    const scheduledTrainingDays = new Set(
      selectedTrainingDays.slice(0, effectiveTrainingDays),
    );
    const forcedRecoveryDays = new Set(
      selectedTrainingDays.slice(effectiveTrainingDays),
    );
    const recoveryTemplate =
      coachPlan.weekly_schedule.find((entry) => entry.type === 'recovery') ??
      null;
    const trainingTemplates = coachPlan.weekly_schedule.filter(
      (entry) => entry.type === 'training',
    );
    let trainingIndex = 0;

    return weekOrder.map((dayCode) => {
      if (scheduledTrainingDays.has(dayCode)) {
        const template =
          trainingTemplates[trainingIndex] ?? trainingTemplates.at(-1) ?? null;
        trainingIndex += 1;

        return {
          dayCode,
          dayLabel: dayLabels[dayCode],
          type: 'training',
          preferredTime,
          preferredTimeLabel: preferredTimeLabels[preferredTime],
          focus: template?.focus ?? 'Full body',
          warmUp:
            template?.warm_up ?? '5 minutes easy cardio plus dynamic mobility',
          mainExercise: template?.main_exercise ?? null,
          exercises: template?.exercises ?? [],
          estimatedMinutes: template?.estimated_minutes ?? null,
          cooldown:
            template?.cooldown ?? '3-5 minutes light stretching and breathing',
          note: 'Scheduled from your selected training window.',
        };
      }

      return {
        dayCode,
        dayLabel: dayLabels[dayCode],
        type: 'recovery',
        preferredTime: forcedRecoveryDays.has(dayCode) ? preferredTime : null,
        preferredTimeLabel: forcedRecoveryDays.has(dayCode)
          ? preferredTimeLabels[preferredTime]
          : null,
        focus: recoveryTemplate?.focus ?? 'Recovery and walking',
        warmUp: null,
        mainExercise: null,
        exercises: [],
        estimatedMinutes: null,
        cooldown: null,
        mobility:
          recoveryTemplate?.mobility ??
          '10 minutes easy mobility if you feel stiff',
        note: forcedRecoveryDays.has(dayCode)
          ? 'ForgeAI kept one recovery day even though every day was selected.'
          : 'Recovery window left open.',
      };
    });
  }

  private buildWorkoutDraft(
    dto: BuildWorkoutPlanDto,
    coachPlan: ModelAiWorkoutPlan,
    previewExercises: ReturnType<AiService['buildPreviewExercises']>,
    title: string,
    selectedTrainingDays: AiTrainingDay[],
    effectiveTrainingDays: number,
  ) {
    const notes = [
      coachPlan.coach_summary,
      `Preferred training window: ${preferredTimeLabels[dto.preferredTime]}.`,
      ...coachPlan.safety_notes.slice(0, 2),
    ].join('\n');

    return {
      title,
      description: coachPlan.coach_summary,
      isTemplate: true,
      scheduledDays: selectedTrainingDays.slice(0, effectiveTrainingDays),
      durationMinutes: dto.sessionMinutes,
      difficulty: this.deriveWorkoutDifficulty(previewExercises),
      goal: dto.goal,
      status: 'planned',
      notes,
      items: previewExercises.map((exercise) => ({
        exerciseName: exercise.title,
        order: exercise.order,
        restSeconds: exercise.restSeconds,
        notes: this.buildExerciseNote(exercise),
        sets: Array.from({ length: exercise.sets }, (_, index) => ({
          order: index + 1,
          ...this.parseWorkoutSetTemplate(exercise.reps, exercise.restSeconds),
        })),
      })),
    };
  }

  private buildWorkoutTemplateDraft(
    dto: BuildMonthlyWorkoutPlanDto,
    coachPlan: ModelAiMonthlyWorkoutPlan,
    template: ModelAiWorkoutTemplate,
    scheduledDays: AiTrainingDay[],
  ) {
    const notes = [
      coachPlan.coach_summary,
      `Preferred training window: ${preferredTimeLabels[dto.preferredTime]}.`,
      `Template focus: ${template.focus}.`,
      ...coachPlan.safety_notes.slice(0, 2),
    ].join('\n');

    return {
      title: template.title,
      description: `${template.focus} template for month 1`,
      isTemplate: true,
      scheduledDays,
      durationMinutes: template.estimated_minutes,
      difficulty: this.deriveTemplateDifficulty(template),
      goal: dto.goal,
      status: 'planned',
      notes,
      items: template.exercises.map((exercise, exerciseIndex) => ({
        exerciseName: exercise.title,
        order: exerciseIndex + 1,
        restSeconds: exercise.rest_seconds,
        notes: [exercise.rationale, exercise.desc].filter(Boolean).join('\n'),
        sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
          order: setIndex + 1,
          ...this.parseWorkoutSetTemplate(exercise.reps, exercise.rest_seconds),
        })),
      })),
    };
  }

  private distributeTemplateScheduledDays(
    selectedTrainingDays: AiTrainingDay[],
    templateCount: number,
  ) {
    if (templateCount <= 0) {
      return [] as AiTrainingDay[][];
    }

    const scheduleByTemplate = Array.from(
      { length: templateCount },
      () => [] as AiTrainingDay[],
    );
    const fallbackTemplateIndex = templateCount - 1;

    selectedTrainingDays.forEach((day, dayIndex) => {
      const templateIndex =
        dayIndex < templateCount ? dayIndex : fallbackTemplateIndex;
      scheduleByTemplate[templateIndex].push(day);
    });

    return scheduleByTemplate;
  }

  private buildWorkoutTitle(
    goal: BuildWorkoutPlanDto['goal'],
    previewExercises: ReturnType<AiService['buildPreviewExercises']>,
  ) {
    const primaryFocus = previewExercises[0]?.bodyPart;

    if (goal === 'mobility') {
      return primaryFocus ? `${primaryFocus} Mobility Flow` : 'Mobility Flow';
    }

    return primaryFocus
      ? `${goalLabels[goal]} ${primaryFocus} Session`
      : `${goalLabels[goal]} Starter Session`;
  }

  private buildExerciseNote(
    exercise: ReturnType<AiService['buildPreviewExercises']>[number],
  ) {
    return [exercise.rationale, exercise.description]
      .filter(Boolean)
      .join('\n');
  }

  private parseWorkoutSetTemplate(
    repsLabel: string,
    restSeconds: number,
  ): WorkoutDraftSetTemplate {
    const normalized = repsLabel.toLowerCase();
    const minuteRangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)\s*minutes?/);

    if (minuteRangeMatch) {
      const low = Number(minuteRangeMatch[1]);
      const high = Number(minuteRangeMatch[2]);

      return {
        durationSeconds: Math.round(((low + high) / 2) * 60),
        restSeconds,
      };
    }

    const secondRangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)\s*seconds?/);

    if (secondRangeMatch) {
      const low = Number(secondRangeMatch[1]);
      const high = Number(secondRangeMatch[2]);

      return {
        durationSeconds: Math.round((low + high) / 2),
        restSeconds,
      };
    }

    const repRangeMatch = normalized.match(/(\d+)\s*-\s*(\d+)/);

    if (repRangeMatch) {
      const low = Number(repRangeMatch[1]);
      const high = Number(repRangeMatch[2]);

      return {
        reps: Math.round((low + high) / 2),
        restSeconds,
      };
    }

    const singleRepMatch = normalized.match(/(\d+)\s*reps?/);

    if (singleRepMatch) {
      return {
        reps: Number(singleRepMatch[1]),
        restSeconds,
      };
    }

    return {
      reps: 10,
      restSeconds,
    };
  }

  private deriveWorkoutDifficulty(
    previewExercises: ReturnType<AiService['buildPreviewExercises']>,
  ) {
    const mappedLevels = previewExercises.map((exercise) =>
      this.mapExerciseLevelToDifficulty(exercise.level),
    );

    if (mappedLevels.includes('advanced')) {
      return 'advanced';
    }

    if (mappedLevels.includes('intermediate')) {
      return 'intermediate';
    }

    return 'beginner';
  }

  private deriveTemplateDifficulty(template: ModelAiWorkoutTemplate) {
    const mappedLevels = template.exercises.map((exercise) =>
      this.mapExerciseLevelToDifficulty(exercise.level),
    );

    if (mappedLevels.includes('advanced')) {
      return 'advanced';
    }

    if (mappedLevels.includes('intermediate')) {
      return 'intermediate';
    }

    return 'beginner';
  }

  private mapExerciseLevelToDifficulty(level: string) {
    switch (level.toLowerCase()) {
      case 'expert':
        return 'advanced';
      case 'intermediate':
        return 'intermediate';
      default:
        return 'beginner';
    }
  }

  private normalizeTrainingDays(trainingDays: AiTrainingDay[]) {
    const ranking = new Map(weekOrder.map((day, index) => [day, index]));

    return [...new Set(trainingDays)].sort(
      (left, right) => ranking.get(left)! - ranking.get(right)!,
    );
  }

  private buildMonthlyWeeks(
    selectedTrainingDays: AiTrainingDay[],
    preferredTime: AiPreferredTime,
    coachPlan: ModelAiMonthlyWorkoutPlan,
    templateWorkouts: Array<ReturnType<AiService['buildMonthlyTemplateView']>>,
  ) {
    const trainingDaySet = new Set(selectedTrainingDays);

    return coachPlan.progression_plan.map((weekPlan, weekIndex) => {
      let templateIndex = 0;

      return {
        weekNumber: weekIndex + 1,
        loadMultiplier: weekPlan.load_multiplier,
        targetSets: weekPlan.target_sets,
        isDeload: weekPlan.is_deload,
        progressionRule: weekPlan.progression_rule,
        focus: weekPlan.focus,
        days: weekOrder.map((dayCode) => {
          if (!trainingDaySet.has(dayCode)) {
            return {
              dayCode,
              dayLabel: dayLabels[dayCode],
              type: 'recovery',
              preferredTime: null,
              preferredTimeLabel: null,
              templateId: null,
              templateTitle: null,
              focus: 'Recovery and walking',
              exercises: [],
              estimatedMinutes: null,
              mobility: '10 minutes easy mobility if you feel stiff',
            };
          }

          const template =
            templateWorkouts[templateIndex] ??
            templateWorkouts[templateWorkouts.length - 1];
          templateIndex += 1;

          return {
            dayCode,
            dayLabel: dayLabels[dayCode],
            type: 'training',
            preferredTime,
            preferredTimeLabel: preferredTimeLabels[preferredTime],
            templateId: template.templateId,
            templateTitle: template.title,
            focus: template.focus,
            exercises: template.exercises.map((exercise) => exercise.title),
            estimatedMinutes: template.estimatedMinutes,
            warmUp: template.warmUp,
            cooldown: template.cooldown,
            loadMultiplier: weekPlan.load_multiplier,
            targetSets: weekPlan.target_sets,
            isDeload: weekPlan.is_deload,
          };
        }),
      };
    });
  }

  private async buildInsightsOverview(userId: string) {
    const [workouts, exercises] = await Promise.all([
      this.prisma.workout.findMany({
        where: {
          userId,
          deletedAt: null,
          isTemplate: false,
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
            include: {
              sets: {
                orderBy: { order: 'asc' },
                select: {
                  reps: true,
                  weightKg: true,
                  durationSeconds: true,
                },
              },
            },
          },
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.exercise.findMany({
        where: {
          deletedAt: null,
          OR: [
            { visibility: { in: [Visibility.system, Visibility.public] } },
            { ownerId: userId },
          ],
        },
        select: {
          id: true,
          muscleGroups: true,
        },
      }),
    ]);

    const exerciseMuscleGroupsById = new Map(
      exercises.map((exercise) => [
        exercise.id,
        exercise.muscleGroups
          .map((group) => group.trim().toLowerCase())
          .filter(Boolean),
      ]),
    );
    const insightWorkouts: InsightWorkout[] = workouts.map((workout) => ({
      status: workout.status,
      isTemplate: workout.isTemplate,
      scheduledFor: workout.scheduledFor,
      updatedAt: workout.updatedAt,
      createdAt: workout.createdAt,
      items: workout.items.map((item) => ({
        exerciseId: item.exerciseId,
        exerciseNameSnapshot: item.exerciseNameSnapshot,
        sets: item.sets.map((set) => ({
          reps: set.reps,
          weightKg: set.weightKg,
          durationSeconds: set.durationSeconds,
        })),
      })),
    }));

    return buildInsightOverview({
      workouts: insightWorkouts,
      exerciseMuscleGroupsById,
    });
  }

  private resolveExerciseCount(sessionMinutes: number) {
    if (sessionMinutes <= 30) {
      return 3;
    }

    if (sessionMinutes <= 45) {
      return 4;
    }

    return 5;
  }
}
