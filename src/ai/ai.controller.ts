import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BuildMonthlyWorkoutPlanDto } from './dto/build-monthly-workout-plan.dto';
import { BuildWorkoutPlanDto } from './dto/build-workout-plan.dto';
import { InsightChatDto } from './dto/insight-chat.dto';
import { AiService } from './ai.service';

type AuthenticatedRequest = { user: { sub: string } };

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('exercise-dataset')
  getExerciseDataset() {
    return this.aiService.getExerciseDataset();
  }

  @Post('workout-builder/preview')
  buildWorkoutPlanPreview(
    @Body() dto: BuildWorkoutPlanDto,
  ): Promise<{ message: string; data: unknown }> {
    return this.aiService.buildWorkoutPlanPreview(dto);
  }

  @Post('workout-builder/monthly-plan')
  buildMonthlyWorkoutPlan(
    @Body() dto: BuildMonthlyWorkoutPlanDto,
  ): Promise<{ message: string; data: unknown }> {
    return this.aiService.buildMonthlyWorkoutPlan(dto);
  }

  @Get('insights/overview')
  getInsightsOverview(@Req() req: AuthenticatedRequest) {
    return this.aiService.getInsightsOverview(req.user.sub);
  }

  @Post('insights/chat')
  sendInsightChatMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: InsightChatDto,
  ) {
    return this.aiService.sendInsightChatMessage(req.user.sub, dto);
  }
}
