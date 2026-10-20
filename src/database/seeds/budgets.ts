import type { EntityManager } from 'typeorm';
import { Budget } from '../../modules/budgets/entities/budget.entity';
import { Category } from '../../modules/transactions/entities/category.entity';
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { demoId } from './demo-id';

export async function seedBudgets(manager: EntityManager, userId: string, secondUser: boolean) {
  const cases = [
    { name: 'Demo presupuesto 80%', amount: secondUser ? '160.00' : '80.00' },
    { name: 'Demo presupuesto 100%', amount: secondUser ? '200.00' : '100.00' },
    { name: 'Demo presupuesto excedido', amount: secondUser ? '200.01' : '100.01' },
  ];
  for (const item of cases) {
    const existing = await manager.getRepository(Category).findOneBy({ userId, name: item.name });
    const categoryId = existing?.id ?? demoId(userId, `${item.name}:category`);
    if (!existing) await manager.getRepository(Category).insert({ id: categoryId, userId, name: item.name });
    const id = demoId(userId, `${item.name}:budget`);
    await manager.query(`INSERT INTO budgets(id,user_id,category_id,month,currency,limit_amount)
      VALUES($1,$2,$3,'2026-02','BOB',$4) ON CONFLICT (user_id,category_id,month) DO NOTHING`,
    [id, userId, categoryId, secondUser ? '200.00' : '100.00']);
    // Do not add demonstration movements to a pre-existing user-owned budget.
    if (!await manager.getRepository(Budget).existsBy({ id, userId })) continue;
    for (const type of ['income', 'expense'] as const) {
      const movementId = demoId(userId, `${item.name}:${type}`);
      if (await manager.getRepository(Transaction).existsBy({ id: movementId, userId })) continue;
      await manager.getRepository(Transaction).insert({ id: movementId, userId, categoryId: type === 'expense' ? categoryId : null, type, status: 'posted', amount: item.amount, currency: 'BOB', occurredAt: new Date('2026-02-15T12:00:00Z'), refundOfId: null });
    }
  }
}
