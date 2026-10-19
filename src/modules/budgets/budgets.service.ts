import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { progressPercentage } from '../../shared/percentage';
import { ExpenseDistributionService } from '../transactions/expense-distribution.service';

interface BudgetPeriod { month: string; start: string; endExclusive: string }
interface BudgetRow { id: string | null; category_id: string; category_name: string; limit_amount: string }

@Injectable()
export class BudgetsService {
  constructor(private readonly persistence: PersistenceService, private readonly expenses: ExpenseDistributionService) {}

  async getForUser(userId: string, period: BudgetPeriod, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, period, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, period, snapshot));
  }

  private async readForUser(userId: string, period: BudgetPeriod, manager: EntityManager) {
    const rows: BudgetRow[] = await manager.query(`
      SELECT b.id, b.category_id, c.name AS category_name, b.limit_amount::text AS limit_amount
      FROM users u LEFT JOIN budgets b ON b.user_id = u.id AND b.month = $2 AND b.currency = u.currency
      LEFT JOIN categories c ON c.id = b.category_id AND c.user_id = u.id
      WHERE u.id = $1 AND u.currency = 'BOB'
      ORDER BY b.category_id ASC, b.id ASC
    `, [userId, period.month]);
    if (rows.length === 0) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    const budgets = rows.filter(row => row.id !== null);
    if (budgets.length === 0) return [];
    const distribution = await this.expenses.getForUser(userId, period, manager);
    const spending = new Map(distribution.filter(row => row.categoryId !== null).map(row => [row.categoryId, decimalToMinorUnits(row.amount)]));
    return budgets.map(row => {
      const limit = decimalToMinorUnits(row.limit_amount);
      if (limit <= 0n || !row.category_id || !row.category_name) return integrityError();
      const spent = spending.get(row.category_id) ?? 0n;
      const state = spent > limit ? 'exceeded' : spent * 100n >= limit * 80n ? 'warning' : 'normal';
      return {
        id: row.id, categoryId: row.category_id, categoryName: row.category_name,
        limit: formatMinorUnits(limit), spent: formatMinorUnits(spent), remaining: formatMinorUnits(limit - spent),
        progress: progressPercentage(spent, limit), state,
      };
    });
  }
}
