import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { IsNull, MoreThan } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { User } from '../users/entities/user.entity';
import { Session } from './entities/session.entity';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password';

export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export interface Identity { userId: string; tokenHash: string }

@Injectable()
export class AuthService {
  constructor(private readonly persistence: PersistenceService) {}

  async login(email: string, password: string) {
    const user = await this.persistence.source.getRepository(User).createQueryBuilder('user')
      .addSelect('user.passwordHash').where('user.email = :email', { email }).getOne();
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales invalidas.' } });
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.persistence.source.getRepository(Session).insert({ tokenHash: tokenHash(accessToken), userId: user.id, expiresAt, revokedAt: null });
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
