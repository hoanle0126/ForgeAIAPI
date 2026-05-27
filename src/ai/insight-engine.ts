type InsightStatus = 'recovered' | 'moderate' | 'overloaded' | 'neutral';

type InsightTrackedMuscle = {
  id: string;
  displayName: string;
};

type InsightMessage = {
  id: string;
  content: string;
  isUser: boolean;
  hasChart?: boolean;
};

type InsightPoint = {
  label: string;
  value: number;
};

type InsightContribution = {
  exerciseName: string;
  volume: number;
};

type InsightMuscleData = {
  id: string;
  volume: number;
  rpe: number;
  status: InsightStatus;
};

type InsightMuscleAnalysis = {
  muscleId: string;
  displayName: string;
  status: InsightStatus;
  volume: number;
  rpe: number;
  trendPercent: number;
  fatigueScore: number;
  recommendation: string;
  loadTrend: InsightPoint[];
  exerciseContributions: InsightContribution[];
  recoveryBalance: InsightPoint[];
};

type InsightOverview = {
  muscleData: InsightMuscleData[];
  muscleAnalyses: InsightMuscleAnalysis[];
  selectedMuscleId: string;
  messages: InsightMessage[];
};

type InsightWorkoutStatus = 'draft' | 'planned' | 'completed' | 'archived';

type InsightWorkoutSet = {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
};

type InsightWorkoutItem = {
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  sets: InsightWorkoutSet[];
};

type InsightWorkout = {
  status: InsightWorkoutStatus;
  isTemplate: boolean;
  scheduledFor: Date | null;
  scheduledDays?: string[];
  updatedAt: Date;
  createdAt: Date;
  items: InsightWorkoutItem[];
};

type InsightOverviewInput = {
  workouts: InsightWorkout[];
  exerciseMuscleGroupsById: Map<string, string[]>;
  now?: Date;
};

type InsightChatInput = {
  prompt: string;
  selectedMuscleId?: string;
  overview: InsightOverview;
};

const weekLabels = ['W1', 'W2', 'W3', 'W4'] as const;
const neutralRecommendation = 'Complete one focused session to build signal.';

const trackedMuscles: InsightTrackedMuscle[] = [
  { id: 'pectoralis_major_r', displayName: 'Chest (R)' },
  { id: 'pectoralis_major_l', displayName: 'Chest (L)' },
  { id: 'latissimus_dorsi_r', displayName: 'Back (R)' },
  { id: 'latissimus_dorsi_l', displayName: 'Back (L)' },
  { id: 'anterior_deltoid_r', displayName: 'Shoulders (R)' },
  { id: 'anterior_deltoid_l', displayName: 'Shoulders (L)' },
  { id: 'biceps_brachii_caput_breve_r', displayName: 'Arms (R)' },
  { id: 'biceps_brachii_caput_breve_l', displayName: 'Arms (L)' },
  { id: 'rectus_abdominis_1', displayName: 'Core' },
  { id: 'rectus_femoris_r', displayName: 'Quads (R)' },
  { id: 'rectus_femoris_l', displayName: 'Quads (L)' },
  { id: 'gluteus_maximus_r', displayName: 'Glutes (R)' },
  { id: 'gluteus_maximus_l', displayName: 'Glutes (L)' },
];

const muscleIdsByGroup: Record<string, string[]> = {
  chest: ['pectoralis_major_r', 'pectoralis_major_l'],
  back: ['latissimus_dorsi_r', 'latissimus_dorsi_l'],
  shoulders: ['anterior_deltoid_r', 'anterior_deltoid_l'],
  arms: ['biceps_brachii_caput_breve_r', 'biceps_brachii_caput_breve_l'],
  core: ['rectus_abdominis_1'],
  legs: ['rectus_femoris_r', 'rectus_femoris_l'],
  glutes: ['gluteus_maximus_r', 'gluteus_maximus_l'],
  hamstrings: ['gluteus_maximus_r', 'gluteus_maximus_l'],
  adductors: ['rectus_femoris_r', 'rectus_femoris_l'],
  full_body: [
    'pectoralis_major_r',
    'pectoralis_major_l',
    'latissimus_dorsi_r',
    'latissimus_dorsi_l',
    'rectus_femoris_r',
    'rectus_femoris_l',
    'rectus_abdominis_1',
  ],
};

const keywordsByGroup: Record<string, string[]> = {
  chest: ['chest', 'bench', 'push up', 'push-up', 'fly', 'press'],
  back: ['back', 'row', 'pull', 'lat', 'deadlift'],
  shoulders: ['shoulder', 'overhead', 'lateral raise', 'front raise'],
  arms: ['biceps', 'triceps', 'curl', 'extension', 'hammer curl'],
  core: ['core', 'plank', 'crunch', 'ab', 'dead bug', 'hollow'],
  legs: ['leg', 'squat', 'lunge', 'calf', 'step up', 'step-up'],
  glutes: ['glute', 'hip thrust', 'bridge'],
  hamstrings: ['hamstring', 'romanian deadlift', 'rdl'],
  full_body: ['full body', 'burpee', 'thruster', 'clean', 'snatch'],
};

type MuscleAccumulator = {
  weekLoads: number[];
  exerciseLoads: Map<string, number>;
  lastActivity: Date | null;
};

export function buildInsightOverview(
  input: InsightOverviewInput,
): InsightOverview {
  const now = input.now ?? new Date();
  const weekStart = startOfWeek(now);
  const accumulators = new Map<string, MuscleAccumulator>(
    trackedMuscles.map((muscle) => [
      muscle.id,
      {
        weekLoads: Array.from({ length: weekLabels.length }, () => 0),
        exerciseLoads: new Map<string, number>(),
        lastActivity: null,
      },
    ]),
  );

  for (const workout of input.workouts) {
    const isStaticTemplate =
      workout.isTemplate &&
      !workout.scheduledFor &&
      (!workout.scheduledDays || workout.scheduledDays.length === 0) &&
      workout.status !== 'completed';

    if (isStaticTemplate || workout.status === 'archived') {
      continue;
    }

    const activityDate = resolveActivityDate(workout) ?? now;
    const weekIndex = resolveWeekIndex(activityDate, weekStart);
    if (weekIndex === null) {
      continue;
    }

    const statusFactor = resolveStatusFactor(workout.status);
    for (const item of workout.items) {
      const groups = resolveGroups(item, input.exerciseMuscleGroupsById);
      if (groups.length === 0) {
        continue;
      }

      const normalizedLoad = resolveItemLoad(item) * statusFactor;
      if (normalizedLoad <= 0) {
        continue;
      }

      const groupPortion = normalizedLoad / groups.length;
      for (const group of groups) {
        const muscleIds = muscleIdsByGroup[group];
        if (!muscleIds || muscleIds.length === 0) {
          continue;
        }

        const musclePortion = groupPortion / muscleIds.length;
        for (const muscleId of muscleIds) {
          const accumulator = accumulators.get(muscleId);
          if (!accumulator) {
            continue;
          }
          addLoad(accumulator, {
            load: musclePortion,
            weekIndex,
            exerciseName: item.exerciseNameSnapshot,
            activityDate,
          });
        }
      }
    }
  }

  const referenceLoad = resolveReferenceLoad(accumulators.values());
  const muscleAnalyses = trackedMuscles
    .map((muscle) =>
      buildMuscleAnalysis({
        muscle,
        accumulator: accumulators.get(muscle.id)!,
        referenceLoad,
        now,
      }),
    )
    .sort((left, right) => right.volume - left.volume);

  const selectedAnalysis =
    muscleAnalyses.find((analysis) => analysis.volume > 0) ?? muscleAnalyses[0];

  return {
    muscleData: muscleAnalyses.map((analysis) => ({
      id: analysis.muscleId,
      volume: analysis.volume,
      rpe: analysis.rpe,
      status: analysis.status,
    })),
    muscleAnalyses,
    selectedMuscleId: selectedAnalysis.muscleId,
    messages: [
      {
        id: 'insight-initial',
        content: buildInitialMessage(selectedAnalysis),
        isUser: false,
      },
    ],
  };
}

export function buildInsightChatReply(input: InsightChatInput): InsightMessage {
  const selected =
    input.overview.muscleAnalyses.find(
      (analysis) => analysis.muscleId === input.selectedMuscleId,
    ) ??
    input.overview.muscleAnalyses.find(
      (analysis) => analysis.muscleId === input.overview.selectedMuscleId,
    ) ??
    fallbackAnalysis(input.selectedMuscleId ?? input.overview.selectedMuscleId);
  const trend = selected.trendPercent.toFixed(0);

  return {
    id: new Date().toISOString(),
    content: `For "${input.prompt}", ${trend}% trend on ${selected.displayName} suggests ${selected.recommendation.toLowerCase()}`,
    isUser: false,
    hasChart: true,
  };
}

function resolveActivityDate(workout: InsightWorkout): Date | null {
  const date = workout.scheduledFor ?? workout.updatedAt ?? workout.createdAt;
  if (!date) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = local.getDay() === 0 ? 6 : local.getDay() - 1;
  local.setDate(local.getDate() - offset);
  return local;
}

function resolveWeekIndex(date: Date, currentWeekStart: Date): number | null {
  const targetWeekStart = startOfWeek(date);
  const dayDiff = Math.floor(
    (currentWeekStart.getTime() - targetWeekStart.getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (dayDiff < 0) {
    return null;
  }

  const weekDiff = Math.floor(dayDiff / 7);
  if (weekDiff >= weekLabels.length) {
    return null;
  }

  return weekLabels.length - 1 - weekDiff;
}

function resolveStatusFactor(status: InsightWorkoutStatus): number {
  switch (status) {
    case 'completed':
      return 1;
    case 'planned':
      return 0.75;
    case 'draft':
      return 0.45;
    case 'archived':
      return 0;
    default:
      return 0;
  }
}

function resolveGroups(
  item: InsightWorkoutItem,
  exerciseMuscleGroupsById: Map<string, string[]>,
): string[] {
  if (item.exerciseId) {
    const known = exerciseMuscleGroupsById.get(item.exerciseId);
    if (known && known.length > 0) {
      return Array.from(
        new Set(known.filter((group) => group in muscleIdsByGroup)),
      );
    }
  }

  const lowerName = item.exerciseNameSnapshot.toLowerCase();
  const inferred: string[] = [];

  for (const [group, keywords] of Object.entries(keywordsByGroup)) {
    if (keywords.some((keyword) => lowerName.includes(keyword))) {
      inferred.push(group);
    }
  }

  if (inferred.length > 0) {
    return Array.from(new Set(inferred));
  }

  return ['full_body'];
}

function resolveItemLoad(item: InsightWorkoutItem): number {
  if (item.sets.length === 0) {
    return 25;
  }

  let total = 0;
  for (const set of item.sets) {
    const reps = set.reps ?? 0;
    const weight = set.weightKg ?? 0;
    const duration = set.durationSeconds ?? 0;

    if (reps > 0 && weight > 0) {
      total += reps * weight;
      continue;
    }
    if (reps > 0) {
      total += reps * 6;
      continue;
    }
    if (duration > 0) {
      total += duration * 0.7;
      continue;
    }

    total += 18;
  }

  return total;
}

function addLoad(
  accumulator: MuscleAccumulator,
  input: {
    load: number;
    weekIndex: number;
    exerciseName: string;
    activityDate: Date;
  },
) {
  accumulator.weekLoads[input.weekIndex] += input.load;
  accumulator.exerciseLoads.set(
    input.exerciseName,
    (accumulator.exerciseLoads.get(input.exerciseName) ?? 0) + input.load,
  );
  if (
    !accumulator.lastActivity ||
    input.activityDate.getTime() > accumulator.lastActivity.getTime()
  ) {
    accumulator.lastActivity = input.activityDate;
  }
}

function resolveReferenceLoad(
  accumulators: Iterable<MuscleAccumulator>,
): number {
  const currentLoads = Array.from(accumulators)
    .map((entry) => entry.weekLoads[weekLabels.length - 1])
    .filter((load) => load > 0)
    .sort((left, right) => left - right);
  if (currentLoads.length === 0) {
    return 1;
  }

  const pivotIndex = Math.floor(currentLoads.length * 0.65);
  const pivot =
    currentLoads[pivotIndex] ?? currentLoads[currentLoads.length - 1];
  return Math.max(1, pivot);
}

function buildMuscleAnalysis(input: {
  muscle: InsightTrackedMuscle;
  accumulator: MuscleAccumulator;
  referenceLoad: number;
  now: Date;
}): InsightMuscleAnalysis {
  const current = input.accumulator.weekLoads[weekLabels.length - 1];
  const previous = input.accumulator.weekLoads[weekLabels.length - 2];
  const trendPercent =
    previous <= 0
      ? current > 0
        ? 100
        : 0
      : ((current - previous) / previous) * 100;
  const fatigueScore = resolveFatigueScore(current, input.referenceLoad);
  const status = resolveStatus(current, fatigueScore);
  const recoveryScore = resolveRecoveryScore({
    fatigueScore,
    now: input.now,
    lastActivity: input.accumulator.lastActivity,
    hasAnyLoad: input.accumulator.weekLoads.some((load) => load > 0),
  });
  const contributions = Array.from(input.accumulator.exerciseLoads.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([exerciseName, volume]) => ({ exerciseName, volume }));

  return {
    muscleId: input.muscle.id,
    displayName: input.muscle.displayName,
    status,
    volume: current,
    rpe: resolveRpe(status, fatigueScore),
    trendPercent,
    fatigueScore: Math.round(fatigueScore),
    recommendation: resolveRecommendation(input.muscle.displayName, status),
    loadTrend: weekLabels.map((label, index) => ({
      label,
      value: input.accumulator.weekLoads[index],
    })),
    exerciseContributions: contributions,
    recoveryBalance: [
      { label: 'Load', value: fatigueScore },
      { label: 'Recovery', value: recoveryScore },
    ],
  };
}

function resolveFatigueScore(
  currentLoad: number,
  referenceLoad: number,
): number {
  if (currentLoad <= 0) {
    return 0;
  }

  const ratio = currentLoad / referenceLoad;
  const score = 25 + ratio * 45;
  return clamp(score, 0, 100);
}

function resolveStatus(current: number, fatigueScore: number): InsightStatus {
  if (current <= 0.1) {
    return 'neutral';
  }
  if (fatigueScore >= 72) {
    return 'overloaded';
  }
  if (fatigueScore >= 45) {
    return 'moderate';
  }
  return 'recovered';
}

function resolveRpe(status: InsightStatus, fatigueScore: number): number {
  if (status === 'neutral') {
    return 0;
  }
  return clamp(4 + fatigueScore / 19, 4, 9.8);
}

function resolveRecoveryScore(input: {
  fatigueScore: number;
  now: Date;
  lastActivity: Date | null;
  hasAnyLoad: boolean;
}): number {
  if (!input.hasAnyLoad) {
    return 90;
  }
  if (!input.lastActivity) {
    return 70;
  }

  const nowDate = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate(),
  );
  const lastDate = new Date(
    input.lastActivity.getFullYear(),
    input.lastActivity.getMonth(),
    input.lastActivity.getDate(),
  );
  const dayDiff = Math.floor(
    (nowDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  const normalizedDayDiff = clamp(dayDiff, 0, 6);
  const restBonus = normalizedDayDiff * 7;
  const score = 100 - input.fatigueScore + restBonus;
  return clamp(score, 12, 94);
}

function resolveRecommendation(
  displayName: string,
  status: InsightStatus,
): string {
  switch (status) {
    case 'overloaded':
      return `${displayName} is carrying high load. Switch focus to a lighter or complementary group today.`;
    case 'moderate':
      return `${displayName} is in a productive zone. Keep volume stable and prioritize clean reps.`;
    case 'recovered':
      return `${displayName} is ready for progression. Add one quality set or a controlled intensity bump.`;
    case 'neutral':
      return neutralRecommendation;
    default:
      return neutralRecommendation;
  }
}

function buildInitialMessage(focus: InsightMuscleAnalysis): string {
  const zone =
    focus.status === 'overloaded'
      ? 'high fatigue'
      : focus.status === 'moderate'
        ? 'balanced load'
        : focus.status === 'recovered'
          ? 'good recovery'
          : 'low signal';

  return `${focus.displayName} is currently in ${zone}. Open a muscle to inspect trend and contribution.`;
}

function fallbackAnalysis(muscleId: string): InsightMuscleAnalysis {
  return {
    muscleId,
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
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type { InsightMessage, InsightOverview, InsightWorkout };
