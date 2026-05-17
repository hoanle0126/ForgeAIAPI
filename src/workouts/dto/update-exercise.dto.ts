import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

import {
  commonMuscleGroups,
  equipmentTypes,
  exerciseDifficulties,
  userExerciseVisibilities,
} from './workout.enums';
import type {
  ExerciseDifficultyDto,
  UserExerciseVisibilityDto,
} from './workout.enums';

export class UpdateExerciseDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @IsIn(commonMuscleGroups, { each: true })
  @IsOptional()
  muscleGroups?: string[];

  @IsIn(equipmentTypes)
  @IsOptional()
  equipment?: string;

  @IsIn(exerciseDifficulties)
  @IsOptional()
  difficulty?: ExerciseDifficultyDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instructions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  safetyNotes?: string[];

  @IsUrl()
  @IsOptional()
  videoUrl?: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsIn(userExerciseVisibilities)
  @IsOptional()
  visibility?: UserExerciseVisibilityDto;
}
