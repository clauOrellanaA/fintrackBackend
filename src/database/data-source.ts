import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Session } from '../modules/auth/entities/session.entity';
import { Category } from '../modules/transactions/entities/category.entity';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { InitialPersistence1792368000000 } from './migrations/1792368000000-InitialPersistence';

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres', url, entities: [User, Session, Category, Transaction],
    migrations: [InitialPersistence1792368000000], synchronize: false, migrationsRun: false,
    migrationsTransactionMode: 'all', logging: false,
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
    extra: { max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000 },
  });
}
