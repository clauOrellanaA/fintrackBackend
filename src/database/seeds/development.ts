import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { createDataSource } from '../data-source';
import { User } from '../../modules/users/entities/user.entity';
import { Category } from '../../modules/transactions/entities/category.entity';
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { hashPassword } from '../../modules/auth/password';
import { seedBudgets } from './budgets';
import { seedSavingsGoals } from './savings-goals';

export const SEED_EMAILS = ['alice@fintrack.test', 'bob@fintrack.test'] as const;

export async function seedDevelopment(source: DataSource, password: string, environment: string | undefined) {
  if (!['development', 'test'].includes(environment ?? '')) throw new Error('Seed permitido solo en development o test.');
  if (password.length < 12 || password.length > 1024) throw new Error('SEED_PASSWORD debe tener entre 12 y 1024 caracteres.');
  const hashes = [await hashPassword(password), await hashPassword(password)];
  await source.transaction(async manager => {
    // Serialize repeated seeds without deleting user-owned data or resetting balances.
    await manager.query('SELECT pg_advisory_xact_lock(1792368000)');
    for (let i = 0; i < SEED_EMAILS.length; i++) {
      const existing = await manager.getRepository(User).findOneBy({ email: SEED_EMAILS[i] });
      const userId = existing?.id ?? randomUUID();
      if (!existing) {
        const categoryId = randomUUID();
        await manager.getRepository(User).insert({ id: userId, email: SEED_EMAILS[i], passwordHash: hashes[i], openingBalance: i === 0 ? '1000.00' : '200.00', openingAt: new Date('2026-01-01T04:00:00.000Z'), currency: 'BOB' });
        await manager.getRepository(Category).insert({ id: categoryId, userId, name: i === 0 ? 'Alimentacion' : 'Transporte' });
        await manager.getRepository(Transaction).insert([
          { id: randomUUID(), userId, categoryId: null, type: 'income', status: 'posted', amount: i === 0 ? '2000.10' : '700.00', currency: 'BOB', occurredAt: new Date('2026-09-15T12:00:00Z'), refundOfId: null },
          { id: randomUUID(), userId, categoryId, type: 'expense', status: 'posted', amount: i === 0 ? '500.05' : '40.50', currency: 'BOB', occurredAt: new Date('2026-10-05T12:00:00Z'), refundOfId: null },
        ]);
      }
      await seedBudgets(manager, userId, i === 1);
      await seedSavingsGoals(manager, userId, i === 1);
    }
  });
}

async function main() {
  if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) throw new Error('Entorno de seed invalido.');
  if (!process.env.DATABASE_URL || !process.env.SEED_PASSWORD) throw new Error('Falta DATABASE_URL o SEED_PASSWORD.');
  const source = createDataSource(process.env.DATABASE_URL);
  try { await source.initialize(); await seedDevelopment(source, process.env.SEED_PASSWORD, process.env.NODE_ENV); console.log('Seed local completado.'); }
  finally { if (source.isInitialized) await source.destroy(); }
}

if (require.main === module) main().catch(() => { console.error('No se pudo preparar el seed local. Revisa entorno y migraciones.'); process.exitCode = 1; });
