import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto';
import { ListWorkoutsQueryDto } from './dto/list-workouts-query.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { WorkoutsService } from './workouts.service';

type AuthenticatedRequest = { user: { sub: string } };

@UseGuards(JwtAuthGuard)
@Controller()
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get('exercises')
  listExercises(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListExercisesQueryDto,
  ) {
    return this.workoutsService.listExercises(req.user.sub, query);
  }

  @Post('exercises')
  createExercise(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateExerciseDto,
  ) {
    return this.workoutsService.createExercise(req.user.sub, dto);
  }

  @Patch('exercises/:id')
  updateExercise(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.workoutsService.updateExercise(req.user.sub, id, dto);
  }

  @Delete('exercises/:id')
  deleteExercise(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workoutsService.deleteExercise(req.user.sub, id);
  }

  @Get('workouts')
  listWorkouts(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListWorkoutsQueryDto,
  ) {
    return this.workoutsService.listWorkouts(req.user.sub, query);
  }

  @Post('workouts')
  createWorkout(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutsService.createWorkout(req.user.sub, dto);
  }

  @Get('workouts/:id')
  getWorkout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workoutsService.getWorkout(req.user.sub, id);
  }

  @Patch('workouts/:id')
  updateWorkout(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWorkoutDto,
  ) {
    return this.workoutsService.updateWorkout(req.user.sub, id, dto);
  }

  @Patch('workouts/:id/items/:itemId/complete')
  completeWorkoutItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.workoutsService.completeWorkoutItem(req.user.sub, id, itemId);
  }

  @Post('workouts/:id/complete')
  completeWorkout(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CompleteWorkoutDto,
  ) {
    return this.workoutsService.completeWorkout(req.user.sub, id, dto);
  }

  @Delete('workouts/:id')
  deleteWorkout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.workoutsService.deleteWorkout(req.user.sub, id);
  }
}
