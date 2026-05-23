import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ModelAiWorkoutInput {
  goal: string;
  equipment: string[];
  height_cm: number;
  weight_kg: number;
  age: number;
  activity_level: string;
  training_days_per_week: number;
  session_minutes: number;
  experience_level: string;
  injuries?: string[];
  feedback?: {
    missed_workouts?: number;
    fatigue_level?: string;
    soreness_areas?: string[];
    completed_workouts?: number;
  };
  plan_type?: 'preview' | 'monthly';
}

export interface ModelAiInsightChatInput {
  prompt: string;
  selected_muscle_id: string;
  selected_muscle_name: string;
  selected_status: string;
  selected_trend_percent: number;
  selected_fatigue_score: number;
  selected_recommendation: string;
  selected_top_exercises: string[];
  high_load_muscles: string[];
  recovered_muscles: string[];
  plan_type?: 'insight_chat';
}

export interface ModelAiInsightChatReply {
  content: string;
  has_chart?: boolean;
  model_version?: string;
  suggested_exercises?: string[];
}

interface ModelAiReadinessAdjustment {
  intensity_modifier: string;
  reason: string;
}

interface ModelAiProgressionWeek {
  week: number;
  load_multiplier: number;
  target_sets: number;
  is_deload: boolean;
  progression_rule: string;
  focus: string;
}

export interface ModelAiWorkoutExercise {
  title: string;
  body_part: string;
  equipment: string;
  level: string;
  type: string;
  desc: string;
  score: number;
  model_score: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  confidence: number;
  rationale: string;
  substitutions: Array<{
    title: string;
    equipment: string;
    level: string;
    reason: string;
  }>;
}

interface ModelAiCommonPlan {
  schema_version: string;
  model_version: string;
  goal_slug: string;
  safety_notes: string[];
  coach_summary: string;
  coach_notes: string[];
  readiness_adjustment: ModelAiReadinessAdjustment;
  progression_plan: ModelAiProgressionWeek[];
}

export interface ModelAiWorkoutPlan extends ModelAiCommonPlan {
  weekly_schedule: Array<{
    day: string;
    type: 'training' | 'recovery';
    focus: string;
    warm_up?: string;
    main_exercise?: string;
    exercises?: string[];
    estimated_minutes?: number;
    cooldown?: string;
    mobility?: string;
  }>;
  workouts: ModelAiWorkoutExercise[];
}

export interface ModelAiWorkoutTemplate {
  template_id: string;
  title: string;
  focus: string;
  estimated_minutes: number;
  warm_up: string;
  cooldown: string;
  exercises: ModelAiWorkoutExercise[];
}

export interface ModelAiMonthlyWorkoutPlan extends ModelAiCommonPlan {
  block_length_weeks: number;
  training_days_per_week: number;
  workout_templates: ModelAiWorkoutTemplate[];
  reassessment: {
    due_after_days: number;
    prompt_title: string;
    summary: string;
    questions: string[];
  };
}

@Injectable()
export class ModelAiRunnerService {
  private readonly logger = new Logger(ModelAiRunnerService.name);

  async buildWorkoutPlan(payload: ModelAiWorkoutInput) {
    return this.runModel<ModelAiWorkoutPlan>({
      ...payload,
      plan_type: 'preview',
    });
  }

  async buildMonthlyWorkoutPlan(payload: ModelAiWorkoutInput) {
    return this.runModel<ModelAiMonthlyWorkoutPlan>({
      ...payload,
      plan_type: 'monthly',
    });
  }

  async buildInsightChatReply(payload: ModelAiInsightChatInput) {
    return this.runModel<ModelAiInsightChatReply>({
      ...payload,
      plan_type: 'insight_chat',
    });
  }

  private async runModel<T>(payload: Record<string, unknown>): Promise<T> {
    const pythonBin = process.env.MODEL_AI_PYTHON_BIN || 'python3';
    const scriptPath = this.resolveScriptPath();
    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
      'utf-8',
    ).toString('base64');

    let stdout = '';
    let stderr = '';

    try {
      const result = await execFileAsync(
        pythonBin,
        [scriptPath, encodedPayload],
        {
          timeout: 20_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const execError = error as Error & { stdout?: string; stderr?: string };
      stdout = execError.stdout ?? '';
      stderr = execError.stderr ?? '';
    }

    if (stderr.trim()) {
      this.logger.warn(stderr.trim());
    }

    const response = this.parseResponse(stdout);

    if ('error' in response) {
      throw new BadRequestException(response.error);
    }

    return response as T;
  }

  private parseResponse(stdout: string) {
    if (!stdout.trim()) {
      throw new InternalServerErrorException(
        'model_ai returned an empty response',
      );
    }

    try {
      return JSON.parse(stdout) as
        | ModelAiWorkoutPlan
        | ModelAiMonthlyWorkoutPlan
        | ModelAiInsightChatReply
        | { error: string };
    } catch (error) {
      this.logger.error(
        `Invalid model_ai response: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        'model_ai returned an invalid response',
      );
    }
  }

  private resolveScriptPath() {
    const candidates = [
      join(__dirname, '../../../model_ai/workout_builder_cli.py'),
      join(process.cwd(), '../model_ai/workout_builder_cli.py'),
      join(process.cwd(), 'model_ai/workout_builder_cli.py'),
    ];
    const scriptPath = candidates.find((candidate) => existsSync(candidate));

    if (!scriptPath) {
      throw new Error(
        `model_ai CLI not found. Checked: ${candidates.join(', ')}`,
      );
    }

    return scriptPath;
  }
}
