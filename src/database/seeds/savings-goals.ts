import type { EntityManager } from 'typeorm';
import { SavingsGoal } from '../../modules/savings-goals/entities/savings-goal.entity';
import { SavingsEntry } from '../../modules/savings-goals/entities/savings-entry.entity';
import { demoId } from './demo-id';

export async function seedSavingsGoals(manager: EntityManager, userId: string, secondUser: boolean) {
  const cases = [
    { name: 'Demo sin aportes', contribution: null, withdrawal: null, targetDate: null, archivedAt: null },
    { name: 'Demo parcial', contribution: secondUser ? '60.00' : '30.00', withdrawal: null, targetDate: '2099-12-31', archivedAt: null },
    { name: 'Demo completada', contribution: secondUser ? '200.00' : '100.00', withdrawal: null, targetDate: '2026-01-31', archivedAt: null },
    { name: 'Demo excedida', contribution: secondUser ? '240.00' : '120.00', withdrawal: secondUser ? '20.00' : '10.00', targetDate: null, archivedAt: null },
    { name: 'Demo vencida', contribution: secondUser ? '40.00' : '20.00', withdrawal: null, targetDate: '2026-01-31', archivedAt: null },
    { name: 'Demo archivada', contribution: secondUser ? '80.00' : '40.00', withdrawal: null, targetDate: null, archivedAt: new Date('2026-04-01T04:00:00Z') },
  ];
  for (const item of cases) {
    const id = demoId(userId, item.name, 'fintrack-be06');
    if (!await manager.getRepository(SavingsGoal).existsBy({ id, userId })) {
      await manager.getRepository(SavingsGoal).insert({ id, userId, name: item.name, target: secondUser ? '200.00' : '100.00', currency: 'BOB', createdAt: new Date('2026-01-01T04:00:00Z'), targetDate: item.targetDate, archivedAt: item.archivedAt, ledgerVersion: '0' });
    }
    for (const [type, amount, at] of [
      ['contribution', item.contribution, '2026-03-15T12:00:00Z'],
      ['withdrawal', item.withdrawal, '2026-03-16T12:00:00Z'],
    ] as const) {
      if (amount === null) continue;
      const entryId = demoId(userId, `${item.name}:${type}`, 'fintrack-be06');
      if (await manager.getRepository(SavingsEntry).existsBy({ id: entryId, userId })) continue;
      await manager.getRepository(SavingsEntry).insert({ id: entryId, userId, goalId: id, type, amount, currency: 'BOB', occurredAt: new Date(at) });
    }
  }
}
