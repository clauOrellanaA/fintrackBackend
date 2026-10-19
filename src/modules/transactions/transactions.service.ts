import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../../database/persistence.module';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(private readonly persistence: PersistenceService) {}
  // Internal domain interface: callers supply the server-resolved identity.
  listForUser(userId: string) {
    return this.persistence.source.getRepository(Transaction).find({ where: { userId }, order: { occurredAt: 'ASC', id: 'ASC' } });
  }
}
