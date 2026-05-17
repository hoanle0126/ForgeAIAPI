import { IsIn, IsOptional, IsString } from 'class-validator';

import {
  commonMuscleGroups,
  equipmentTypes,
  exerciseDifficulties,
  exerciseVisibilities,
} from './workout.enums';

export class ListExercisesQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsIn(commonMuscleGroups)
  @IsOptional()
  muscleGroup?: string;

  @IsIn(equipmentTypes)
  @IsOptional()
  equipment?: string;

  @IsIn(exerciseDifficulties)
  @IsOptional()
  difficulty?: string;

  @IsIn(exerciseVisibilities)
  @IsOptional()
  visibility?: string;
}
