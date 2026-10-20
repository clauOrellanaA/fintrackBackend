import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { type Identity } from '../auth/auth.service';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentIdentity() identity: Identity, @Query() query: Record<string, unknown>) {
    return this.reports.getForUser(identity.userId, query);
  }
}
