import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { WorkoutsController } from './workouts.controller';
import { WorkoutsService } from './workouts.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
