import { ArrayMaxSize, ArrayMinSize, IsIn } from 'class-validator';

import { aiTrainingDays, BuildWorkoutPlanDto } from './build-workout-plan.dto';

export class BuildMonthlyWorkoutPlanDto extends BuildWorkoutPlanDto {
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsIn(aiTrainingDays, { each: true })
  declare trainingDays: BuildWorkoutPlanDto['trainingDays'];
}
