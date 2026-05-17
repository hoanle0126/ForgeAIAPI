import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
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

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(commonMuscleGroups, { each: true })
  muscleGroups!: string[];

  @IsIn(equipmentTypes)
  equipment!: string;

  @IsIn(exerciseDifficulties)
  difficulty!: ExerciseDifficultyDto;

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
