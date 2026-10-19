import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { percentageOf } from '../../shared/percentage';
import { MONTHLY_POSTED_JOIN, OWNED_BOB_USER, type MonthlyPeriod } from './monthly-scope';

interface ExpenseRow { category_id: string | null; category_name: string | null; amount: string | null; movement_count: string }

@Injectable()
export class ExpenseDistributionService {
  constructor(private readonly persistence: PersistenceService) {}

  async getForUser(userId: string, period: MonthlyPeriod, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, period, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, period, snapshot));
  }

  private async readForUser(userId: string, period: MonthlyPeriod, manager: EntityManager) {
    const rows: ExpenseRow[] = await manager.query(`
      SELECT c.id AS category_id, c.name AS category_name, SUM(t.amount)::text AS amount,
        COUNT(t.id)::text AS movement_count
      FROM users u LEFT JOIN transactions t ON ${MONTHLY_POSTED_JOIN} AND t.type = 'expense'
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = u.id
      WHERE ${OWNED_BOB_USER}
      GROUP BY u.id, c.id, c.name
      ORDER BY SUM(t.amount) DESC NULLS LAST, c.id ASC NULLS LAST
    `, [userId, period.start, period.endExclusive]);
    if (rows.length === 0) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    const groups = rows.filter(row => row.movement_count !== '0').map(row => {
      const amount = decimalToMinorUnits(row.amount);
      if (amount <= 0n || (row.category_id !== null && row.category_name === null)) return integrityError();
      return { ...row, minorUnits: amount };
    });
    if (groups.length === 0) return [];
    const total = groups.reduce((sum, row) => sum + row.minorUnits, 0n);
    formatMinorUnits(total); // Enforce the same aggregate range as monthly expense.
    return groups.map(row => ({
      categoryId: row.category_id, categoryName: row.category_name ?? 'Sin categoria',
      amount: formatMinorUnits(row.minorUnits), percentage: percentageOf(row.minorUnits, total),
    }));
  }
}
