import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { type Identity } from '../auth/auth.service';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(@CurrentIdentity() identity: Identity, @Query() query: Record<string, unknown>) {
    return this.notifications.getForUser(identity.userId, query);
  }
}
