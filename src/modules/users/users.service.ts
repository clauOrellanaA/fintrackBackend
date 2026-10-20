import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { QueryFailedError } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { PRODUCT_TIME_ZONE } from '../../shared/product-time';
import { User } from './entities/user.entity';

export interface ProfileUpdate {
  displayName?: string;
  email?: string;
  openingBalance?: string;
  openingDate?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly persistence: PersistenceService) {}

  async requireUser(userId: string) {
    const user = await this.persistence.source.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    return { id: user.id, currency: user.currency };
  }

  async getProfile(userId: string) {
    const user = await this.persistence.source.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    return {
      email: user.email,
      displayName: user.displayName,
      openingBalance: user.openingBalance,
      openingDate: DateTime.fromJSDate(user.openingAt, { zone: PRODUCT_TIME_ZONE }).toISODate(),
      currency: user.currency,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdate) {
    const changes: Partial<User> = {};
    if (input.displayName !== undefined) changes.displayName = input.displayName;
    if (input.email !== undefined) changes.email = input.email;
    if (input.openingBalance !== undefined) changes.openingBalance = input.openingBalance;
    if (input.openingDate !== undefined) {
      const date = DateTime.fromISO(input.openingDate, { zone: PRODUCT_TIME_ZONE });
      if (!date.isValid || date.toISODate() !== input.openingDate || input.openingDate > DateTime.now().setZone(PRODUCT_TIME_ZONE).toISODate()!) {
        throw new ConflictException({ error: { code: 'INVALID_OPENING_DATE', message: 'La fecha inicial debe ser valida y no futura.' } });
      }
      changes.openingAt = date.startOf('day').toJSDate();
    }
    try {
      await this.persistence.source.getRepository(User).update({ id: userId }, changes);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Este correo ya tiene una cuenta.' } });
      }
      if (input.openingDate !== undefined && isCheckViolation(error)) {
        throw new ConflictException({ error: { code: 'OPENING_DATE_CONFLICT', message: 'La fecha inicial no puede ser posterior a movimientos o metas existentes.' } });
      }
      throw error;
    }
    return this.getProfile(userId);
  }
}

function driverCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError: unknown = error.driverError;
  if (!driverError || typeof driverError !== 'object' || !('code' in driverError)) return undefined;
  return typeof driverError.code === 'string' ? driverError.code : undefined;
}

function isUniqueViolation(error: unknown): boolean { return driverCode(error) === '23505'; }
function isCheckViolation(error: unknown): boolean { return driverCode(error) === '23514'; }
