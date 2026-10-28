import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { type Identity } from '../auth/auth.service';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { SavingsGoalsService } from './savings-goals.service';

@Controller('savings-goals')
@UseGuards(SessionGuard)
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentIdentity() identity: Identity) {
    return this.goals.listForUser(identity.userId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    return this.goals.createForUser(identity.userId, body);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.goals.updateForUser(identity.userId, id, body);
  }

  @Post(':id/entries')
  @Header('Cache-Control', 'no-store')
  addEntry(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.goals.addEntryForUser(identity.userId, id, body);
  }
}
