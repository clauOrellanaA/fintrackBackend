import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Session } from '../modules/auth/entities/session.entity';
import { Category } from '../modules/transactions/entities/category.entity';
import { Transaction } from '../modules/transactions/entities/transaction.entity';
import { InitialPersistence1792368000000 } from './migrations/1792368000000-InitialPersistence';
import { Budget } from '../modules/budgets/entities/budget.entity';
import { Budgets1792454400000 } from './migrations/1792454400000-Budgets';
import { SavingsGoal } from '../modules/savings-goals/entities/savings-goal.entity';
import { SavingsEntry } from '../modules/savings-goals/entities/savings-entry.entity';
import { SavingsGoals1792540800000 } from './migrations/1792540800000-SavingsGoals';
import { TransactionDescription1792627200000 } from './migrations/1792627200000-TransactionDescription';

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres', url, entities: [User, Session, Category, Transaction, Budget, SavingsGoal, SavingsEntry],
    migrations: [InitialPersistence1792368000000, Budgets1792454400000, SavingsGoals1792540800000, TransactionDescription1792627200000], synchronize: false, migrationsRun: false,
    migrationsTransactionMode: 'all', logging: false,
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
    extra: { max: 5, connectionTimeoutMillis: 3000, statement_timeout: 5000 },
  });
}
