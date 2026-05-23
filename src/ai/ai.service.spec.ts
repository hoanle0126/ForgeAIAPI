import { AiService } from './ai.service';
import { ModelAiRunnerService } from './model-ai-runner.service';

interface WorkoutPlanPreviewResult {
  data: {
    plan: {
      autoRecoveryInserted: boolean;
      schedule: Array<{
        dayCode: string;
        type: string;
      }>;
      exercises: unknown[];
    };
    workoutDraft: {
      title: string;
      isTemplate: boolean;
      scheduledDays: string[];
      goal: string;
      durationMinutes: number;
      items: Array<{
        exerciseName: string;
        order: number;
        sets: Array<{
          order: number;
          reps: number;
          restSeconds: number;
        }>;
      }>;
    };
  };
}

interface MonthlyWorkoutPlanResult {
  message: string;
  data: {
    plan: {
      blockLengthWeeks: number;
      weeks: Array<{
        days: Array<{
          dayCode: string;
          type: string;
          templateId: string | null;
        }>;
      }>;
      templateWorkouts: unknown[];
      reassessment: {
        dueAfterDays: number;
      };
    };
    workoutTemplateDrafts: Array<{
      title: string;
      isTemplate: boolean;
      scheduledDays: string[];
    }>;
  };
}

describe('AiService', () => {
  let prisma: {
    exercise: {
      findMany: jest.Mock;
    };
  };
  let modelAiRunner: {
    buildWorkoutPlan: jest.Mock;
    buildMonthlyWorkoutPlan: jest.Mock;
  };
  let service: AiService;

  beforeEach(() => {
    prisma = {
      exercise: {
        findMany: jest.fn(),
      },
    };
    modelAiRunner = {
      buildWorkoutPlan: jest.fn(),
      buildMonthlyWorkoutPlan: jest.fn(),
    };

    service = new AiService(
      prisma as never,
      modelAiRunner as unknown as ModelAiRunnerService,
    );
  });

  it('returns only sanitized public and system exercises for AI training data', async () => {
    prisma.exercise.findMany.mockResolvedValue([
      {
        id: 'exercise-public',
        name: 'Push Up',
        description: 'Bodyweight chest press',
        muscleGroups: ['chest', 'arms'],
        equipment: 'bodyweight',
        difficulty: 'beginner',
        instructions: ['Brace core', 'Lower with control'],
        safetyNotes: ['Keep neck neutral'],
        visibility: 'public',
      },
    ]);

    const result = await service.getExerciseDataset();

    expect(prisma.exercise.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        visibility: { in: ['public', 'system'] },
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
    expect(result.data.exercises).toEqual([
      {
        id: 'exercise-public',
        name: 'Push Up',
        description: 'Bodyweight chest press',
        muscleGroups: ['chest', 'arms'],
        equipment: 'bodyweight',
        difficulty: 'beginner',
        instructions: ['Brace core', 'Lower with control'],
        safetyNotes: ['Keep neck neutral'],
        visibility: 'public',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('ownerId');
  });

  it('builds a workout preview and caps seven selected days to keep one recovery day', async () => {
    modelAiRunner.buildWorkoutPlan.mockResolvedValue({
      schema_version: 'coach-plan-v1',
      model_version: 'sklearn-random-forest-regressor',
      goal_slug: 'build_muscle',
      safety_notes: ['Start conservatively.', 'Use this as general guidance.'],
      coach_summary:
        'Weekly focus: build muscle with 6 training days and one protected recovery day.',
      coach_notes: [],
      readiness_adjustment: {
        intensity_modifier: 'maintain',
        reason: 'No recovery issues reported.',
      },
      progression_plan: [
        {
          week: 1,
          load_multiplier: 1,
          target_sets: 3,
          is_deload: false,
          progression_rule: 'Add 1-2 reps before load.',
          focus: 'build muscle',
        },
      ],
      weekly_schedule: [
        {
          day: 'Mon',
          type: 'training',
          focus: 'Chest',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Incline push-up',
          exercises: ['Incline push-up', 'Push-up', 'Band row'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Tue',
          type: 'training',
          focus: 'Back',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Band row',
          exercises: ['Band row', 'Biceps curl', 'Plank'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Wed',
          type: 'training',
          focus: 'Legs',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Goblet squat',
          exercises: ['Goblet squat', 'Split squat', 'Calf raise'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Thu',
          type: 'training',
          focus: 'Shoulders',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Shoulder press',
          exercises: ['Shoulder press', 'Lateral raise', 'Band pull-apart'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Fri',
          type: 'training',
          focus: 'Arms',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Hammer curl',
          exercises: ['Hammer curl', 'Triceps extension', 'Push-up'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Sat',
          type: 'training',
          focus: 'Core',
          warm_up: '5 minutes easy cardio plus dynamic mobility',
          main_exercise: 'Dead bug',
          exercises: ['Dead bug', 'Plank', 'Bird dog'],
          estimated_minutes: 35,
          cooldown: '3-5 minutes light stretching and breathing',
        },
        {
          day: 'Sun',
          type: 'recovery',
          focus: 'Recovery and walking',
          mobility: '10 minutes easy mobility if you feel stiff',
        },
      ],
      workouts: [
        {
          title: 'Incline push-up',
          body_part: 'Chest',
          equipment: 'Body Only',
          level: 'Beginner',
          type: 'Strength',
          desc: 'Elevated push-up for beginners.',
          score: 9.2,
          model_score: 11.1,
          sets: 3,
          reps: '8-12 reps',
          rest_seconds: 75,
          confidence: 0.92,
          rationale: 'Matches your chest focus with bodyweight availability.',
          substitutions: [],
        },
        {
          title: 'Band row',
          body_part: 'Back',
          equipment: 'Bands',
          level: 'Beginner',
          type: 'Strength',
          desc: 'Horizontal pull to balance pressing volume.',
          score: 8.7,
          model_score: 10.9,
          sets: 3,
          reps: '8-12 reps',
          rest_seconds: 75,
          confidence: 0.9,
          rationale: 'Supports posture and upper-back strength.',
          substitutions: [],
        },
        {
          title: 'Goblet squat',
          body_part: 'Legs',
          equipment: 'Dumbbell',
          level: 'Intermediate',
          type: 'Strength',
          desc: 'Simple squat pattern for lower-body strength.',
          score: 8.9,
          model_score: 10.6,
          sets: 3,
          reps: '8-12 reps',
          rest_seconds: 90,
          confidence: 0.88,
          rationale: 'Builds leg strength with a single dumbbell.',
          substitutions: [],
        },
      ],
    });

    const result = (await service.buildWorkoutPlanPreview({
      goal: 'muscle_gain',
      equipment: ['bodyweight', 'band', 'dumbbell'],
      heightCm: 180,
      weightKg: 82,
      age: 29,
      activityLevel: 'active',
      trainingDays: ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'],
      sessionMinutes: 30,
      preferredTime: 'evening',
    })) as WorkoutPlanPreviewResult;

    expect(modelAiRunner.buildWorkoutPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'muscle_gain',
        training_days_per_week: 6,
        session_minutes: 30,
      }),
    );
    expect(result.data.plan.autoRecoveryInserted).toBe(true);
    expect(result.data.plan.schedule).toHaveLength(7);
    expect(result.data.plan.schedule[6]).toEqual(
      expect.objectContaining({
        dayCode: 'su',
        type: 'recovery',
      }),
    );
    expect(result.data.plan.exercises).toHaveLength(3);
    expect(result.data.workoutDraft).toEqual(
      expect.objectContaining({
        title: 'Muscle Gain Chest Session',
        isTemplate: true,
        scheduledDays: ['mo', 'tu', 'we', 'th', 'fr', 'sa'],
        goal: 'muscle_gain',
        durationMinutes: 30,
      }),
    );
    expect(result.data.workoutDraft.items[0]).toEqual(
      expect.objectContaining({
        exerciseName: 'Incline push-up',
        order: 1,
      }),
    );
    expect(result.data.workoutDraft.items[0].sets[0]).toEqual(
      expect.objectContaining({
        order: 1,
        reps: 10,
        restSeconds: 75,
      }),
    );
  });

  it('builds a 4-week monthly plan with four template drafts and reassessment', async () => {
    modelAiRunner.buildMonthlyWorkoutPlan.mockResolvedValue({
      schema_version: 'coach-month-plan-v1',
      model_version: 'sklearn-random-forest-regressor',
      goal_slug: 'build_muscle',
      block_length_weeks: 4,
      training_days_per_week: 4,
      safety_notes: ['Start conservatively.', 'Use this as general guidance.'],
      coach_summary:
        '4-week block for build muscle with 4 training days per week.',
      coach_notes: ['Recovery looks manageable.'],
      readiness_adjustment: {
        intensity_modifier: 'maintain',
        reason: 'No recovery issues reported.',
      },
      progression_plan: [
        {
          week: 1,
          load_multiplier: 1,
          target_sets: 3,
          is_deload: false,
          progression_rule: 'Add 1-2 reps before load.',
          focus: 'build muscle',
        },
        {
          week: 2,
          load_multiplier: 1.08,
          target_sets: 3,
          is_deload: false,
          progression_rule: 'Add 1-2 reps before load.',
          focus: 'build muscle',
        },
        {
          week: 3,
          load_multiplier: 1.15,
          target_sets: 4,
          is_deload: false,
          progression_rule: 'Add 1-2 reps before load.',
          focus: 'build muscle',
        },
        {
          week: 4,
          load_multiplier: 0.85,
          target_sets: 2,
          is_deload: true,
          progression_rule: 'Deload and recover.',
          focus: 'build muscle',
        },
      ],
      workout_templates: [
        mockedTemplate('session_1', 'Session A: Chest Focus', 'Chest'),
        mockedTemplate('session_2', 'Session B: Back Focus', 'Back'),
        mockedTemplate('session_3', 'Session C: Legs Focus', 'Legs'),
        mockedTemplate('session_4', 'Session D: Shoulders Focus', 'Shoulders'),
      ],
      reassessment: {
        due_after_days: 28,
        prompt_title: 'Month-end training check-in',
        summary: 'Review completion and recovery before month 2.',
        questions: ['Which sessions felt best?', 'What should change next?'],
      },
    });

    const result = (await service.buildMonthlyWorkoutPlan({
      goal: 'muscle_gain',
      equipment: ['bodyweight', 'band', 'dumbbell'],
      heightCm: 180,
      weightKg: 82,
      age: 29,
      activityLevel: 'active',
      trainingDays: ['mo', 'tu', 'th', 'sa'],
      sessionMinutes: 45,
      preferredTime: 'evening',
    })) as MonthlyWorkoutPlanResult;

    expect(modelAiRunner.buildMonthlyWorkoutPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'muscle_gain',
        training_days_per_week: 4,
      }),
    );
    expect(result.message).toBe(
      'AI monthly workout plan generated successfully',
    );
    expect(result.data.plan.blockLengthWeeks).toBe(4);
    expect(result.data.plan.weeks).toHaveLength(4);
    expect(result.data.plan.templateWorkouts).toHaveLength(4);
    expect(result.data.plan.reassessment).toEqual(
      expect.objectContaining({
        dueAfterDays: 28,
      }),
    );
    expect(result.data.workoutTemplateDrafts).toHaveLength(4);
    expect(
      result.data.workoutTemplateDrafts.map((draft) => draft.scheduledDays),
    ).toEqual([['mo'], ['tu'], ['th'], ['sa']]);
    expect(result.data.workoutTemplateDrafts[0]).toEqual(
      expect.objectContaining({
        title: 'Session A: Chest Focus',
        isTemplate: true,
      }),
    );
    expect(result.data.plan.weeks[0].days[0]).toEqual(
      expect.objectContaining({
        dayCode: 'mo',
        type: 'training',
        templateId: 'session_1',
      }),
    );
  });

  function mockedTemplate(templateId: string, title: string, focus: string) {
    return {
      template_id: templateId,
      title,
      focus,
      estimated_minutes: 42,
      warm_up: '5 minutes easy cardio plus dynamic mobility',
      cooldown: '3-5 minutes light stretching and breathing',
      exercises: [
        {
          title: `${focus} Move 1`,
          body_part: focus,
          equipment: 'Body Only',
          level: 'Beginner',
          type: 'Strength',
          desc: `Primary ${focus.toLowerCase()} movement.`,
          score: 9,
          model_score: 10.4,
          sets: 3,
          reps: '8-12 reps',
          rest_seconds: 75,
          confidence: 0.9,
          rationale: `Matches your ${focus.toLowerCase()} focus.`,
          substitutions: [],
        },
        {
          title: `${focus} Move 2`,
          body_part: focus,
          equipment: 'Dumbbell',
          level: 'Intermediate',
          type: 'Strength',
          desc: `Secondary ${focus.toLowerCase()} movement.`,
          score: 8.5,
          model_score: 10.1,
          sets: 3,
          reps: '8-12 reps',
          rest_seconds: 75,
          confidence: 0.88,
          rationale: `Supports ${focus.toLowerCase()} strength.`,
          substitutions: [],
        },
      ],
    };
  }
});
