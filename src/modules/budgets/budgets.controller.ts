import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { type Identity } from '../auth/auth.service';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
@UseGuards(SessionGuard)
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentIdentity() identity: Identity, @Query() query: Record<string, unknown>) {
    return this.budgets.listForUser(identity.userId, query);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    return this.budgets.createForUser(identity.userId, body);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.budgets.updateForUser(identity.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string) {
    await this.budgets.removeForUser(identity.userId, id);
  }
}
