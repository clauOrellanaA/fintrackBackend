import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import { type Identity } from '../auth/auth.service';
import { CategoriesService } from './transactions.service';

@Controller('categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentIdentity() identity: Identity) {
    return this.categories.listForUser(identity.userId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    return this.categories.createForUser(identity.userId, body);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.categories.updateForUser(identity.userId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(@CurrentIdentity() identity: Identity, @Param('id', ParseUUIDPipe) id: string) {
    await this.categories.removeForUser(identity.userId, id);
  }
}
