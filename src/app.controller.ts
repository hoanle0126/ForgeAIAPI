import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppService } from './app.service';

type AuthenticatedRequest = { user: { sub: string } };

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/home')
  getDashboardHome(@Req() req: AuthenticatedRequest) {
    return this.appService.getDashboardHome(req.user.sub);
  }
}
