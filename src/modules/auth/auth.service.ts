import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EntityManager, IsNull, MoreThan, QueryFailedError } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { PRODUCT_TIME_ZONE } from '../../shared/product-time';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';
import { DateTime } from 'luxon';

export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export interface Identity { userId: string; tokenHash: string }

@Injectable()
export class AuthService {
  constructor(private readonly persistence: PersistenceService) {}

  async register(email: string, password: string, displayName: string) {
    const user = this.persistence.source.getRepository(User).create({
      id: randomUUID(),
      email,
      displayName,
      passwordHash: await hashPassword(password),
      openingBalance: '0.00',
      openingAt: DateTime.now().setZone(PRODUCT_TIME_ZONE).startOf('day').toJSDate(),
      currency: 'BOB',
    });
    try {
      return await this.persistence.source.transaction(async manager => {
        await manager.getRepository(User).insert(user);
        return this.createSession(manager, user.id);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Este correo ya tiene una cuenta.' } });
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.persistence.source.getRepository(User).createQueryBuilder('user')
      .addSelect('user.passwordHash').where('user.email = :email', { email }).getOne();
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas.' } });
    return this.persistence.source.transaction(async manager => {
      const current = await manager.getRepository(User).createQueryBuilder('user')
        .addSelect('user.passwordHash').setLock('pessimistic_write')
        .where('user.id = :id', { id: user.id }).getOne();
      if (!current || current.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas.' } });
      }
      return this.createSession(manager, user.id);
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.persistence.source.getRepository(User).createQueryBuilder('user')
      .addSelect('user.passwordHash').where('user.id = :userId', { userId }).getOne();
    const valid = await verifyPassword(currentPassword, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw new UnauthorizedException({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'La contrasena actual no es correcta.' } });
    }
    const passwordHash = await hashPassword(newPassword);
    await this.persistence.source.transaction(async manager => {
      const current = await manager.getRepository(User).createQueryBuilder('user')
        .addSelect('user.passwordHash').setLock('pessimistic_write')
        .where('user.id = :userId', { userId }).getOne();
      if (!current || current.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'La contrasena actual ya no es vigente.' } });
      }
      await manager.getRepository(User).update({ id: userId }, { passwordHash });
      await manager.getRepository(Session).update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    });
  }

  private async createSession(manager: EntityManager, userId: string) {
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await manager.getRepository(Session).insert({ tokenHash: tokenHash(accessToken), userId, expiresAt, revokedAt: null });
    return { accessToken, tokenType: 'Bearer', expiresAt: expiresAt.toISOString() };
  }

  async authenticate(authorization: unknown): Promise<Identity> {
    const match = typeof authorization === 'string' ? /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(authorization) : null;
    if (match) {
      const hash = tokenHash(match[1]);
      const session = await this.persistence.source.getRepository(Session).findOneBy({ tokenHash: hash, expiresAt: MoreThan(new Date()), revokedAt: IsNull() });
      if (session) return { userId: session.userId, tokenHash: hash };
    }
    throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
  }

  async logout(identity: Identity) {
    await this.persistence.source.getRepository(Session).update({ tokenHash: identity.tokenHash, userId: identity.userId }, { revokedAt: new Date() });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';
}
