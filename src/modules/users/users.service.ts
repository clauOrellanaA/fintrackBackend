import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PersistenceService } from '../../database/persistence.module';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly persistence: PersistenceService) {}
  async requireUser(userId: string) {
    const user = await this.persistence.source.getRepository(User).findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    return { id: user.id, currency: user.currency };
  }
}
