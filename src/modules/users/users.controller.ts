import { BadRequestException, Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import { CurrentIdentity, SessionGuard } from '../auth/session.guard';
import type { Identity } from '../auth/auth.service';
import { UsersService, type ProfileUpdate } from './users.service';

@Controller('users/me')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getProfile(@CurrentIdentity() identity: Identity) {
    return this.users.getProfile(identity.userId);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  updateProfile(@CurrentIdentity() identity: Identity, @Body() body: unknown) {
    const data = body as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length
      || Object.keys(data).some(key => !['displayName', 'email', 'openingBalance', 'openingDate'].includes(key))) {
      throw new BadRequestException({ error: { code: 'INVALID_REQUEST', message: 'No se recibieron cambios de perfil validos.' } });
    }

    const update: ProfileUpdate = {};
    if ('displayName' in data) {
      if (typeof data.displayName !== 'string' || !data.displayName.trim() || data.displayName.trim().length > 80) {
        throw invalidProfile();
      }
      update.displayName = data.displayName.trim();
    }
    if ('email' in data) {
      if (typeof data.email !== 'string' || data.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
        throw invalidProfile();
      }
      update.email = data.email.trim().toLowerCase();
    }
    if ('openingBalance' in data) {
      if (typeof data.openingBalance !== 'string' || !/^-?(0|[1-9][0-9]{0,11})\.[0-9]{2}$/.test(data.openingBalance)) {
        throw invalidProfile();
      }
      update.openingBalance = data.openingBalance === '-0.00' ? '0.00' : data.openingBalance;
    }
    if ('openingDate' in data) {
      if (typeof data.openingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.openingDate)) throw invalidProfile();
      update.openingDate = data.openingDate;
    }
    return this.users.updateProfile(identity.userId, update);
  }
}

function invalidProfile() {
  return new BadRequestException({ error: { code: 'INVALID_PROFILE', message: 'Revisa los datos del perfil e intenta nuevamente.' } });
}
