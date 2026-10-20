import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { type Identity } from '../auth/auth.service';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentIdentity() identity: Identity, @Query() query: Record<string, unknown>) {
    return this.dashboard.getForUser(identity.userId, query);
  }
}
