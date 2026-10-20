import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { type Identity } from '../auth/auth.service';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentIdentity() identity: Identity, @Query() query: Record<string, unknown>) {
    return this.transactions.listForUser(identity.userId, query);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    return this.transactions.createForUser(identity.userId, body);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.getForUser(identity.userId, id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.transactions.updateForUser(identity.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  voidTransaction(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.voidForUser(identity.userId, id);
  }
}
