import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DateTime } from 'luxon';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { progressPercentage } from '../../shared/percentage';
import { PRODUCT_TIME_ZONE } from '../../shared/product-time';
import { SAVINGS_DELTA } from './savings-scope';

interface GoalRow { id: string | null; name: string; target_amount: string; target_date: string | null; saved: string }

@Injectable()
export class SavingsGoalsService {
  constructor(private readonly persistence: PersistenceService) {}

  async getForUser(userId: string, asOf: Date, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, asOf, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, asOf, snapshot));
  }

  private async readForUser(userId: string, asOf: Date, manager: EntityManager) {
    const today = DateTime.fromJSDate(asOf, { zone: PRODUCT_TIME_ZONE }).toISODate();
    if (!today) return integrityError();
    const rows: GoalRow[] = await manager.query(`
      SELECT g.id, g.name, g.target_amount::text AS target_amount,
        TO_CHAR(g.target_date, 'YYYY-MM-DD') AS target_date, COALESCE(SUM(${SAVINGS_DELTA}), 0)::text AS saved
      FROM users u LEFT JOIN savings_goals g ON g.user_id = u.id AND g.currency = u.currency
        AND g.created_at <= $2 AND (g.archived_at IS NULL OR g.archived_at > $2)
      LEFT JOIN savings_entries e ON e.goal_id = g.id AND e.user_id = u.id AND e.currency = g.currency AND e.occurred_at <= $2
      WHERE u.id = $1 AND u.currency = 'BOB'
      GROUP BY u.id, g.id, g.name, g.target_amount, g.target_date, g.created_at
      ORDER BY g.created_at ASC, g.id ASC
    `, [userId, asOf]);
    if (rows.length === 0) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    return rows.filter(row => row.id !== null).map(row => {
      const target = decimalToMinorUnits(row.target_amount);
      const saved = decimalToMinorUnits(row.saved);
      if (target <= 0n || saved < 0n) return integrityError();
      const state = saved >= target ? 'completed' : row.target_date && row.target_date < today ? 'overdue' : 'active';
      return { id: row.id, name: row.name, target: formatMinorUnits(target), saved: formatMinorUnits(saved),
        remaining: formatMinorUnits(saved >= target ? 0n : target - saved), progress: progressPercentage(saved, target), state, targetDate: row.target_date };
    });
  }
}
