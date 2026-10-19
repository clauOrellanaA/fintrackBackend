import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { MONTHLY_POSTED_JOIN, OWNED_BOB_USER, type MonthlyPeriod } from './monthly-scope';

interface SummaryRow { income: string; expense: string }

@Injectable()
export class MonthlySummaryService {
  constructor(private readonly persistence: PersistenceService) {}

  async getForUser(userId: string, period: MonthlyPeriod, manager?: EntityManager) {
    if (manager) return this.readForUser(userId, period, manager);
    return this.persistence.source.transaction('REPEATABLE READ', snapshot => this.readForUser(userId, period, snapshot));
  }

  private async readForUser(userId: string, period: MonthlyPeriod, manager: EntityManager) {
    const rows: SummaryRow[] = await manager.query(`
      SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0)::text AS income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0)::text AS expense
      FROM users u LEFT JOIN transactions t ON ${MONTHLY_POSTED_JOIN}
      WHERE ${OWNED_BOB_USER}
      GROUP BY u.id
    `, [userId, period.start, period.endExclusive]);
    const row = rows[0];
    if (!row) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
    const income = decimalToMinorUnits(row.income);
    const expense = decimalToMinorUnits(row.expense);
    if (income < 0n || expense < 0n) return integrityError();
    return { income: formatMinorUnits(income), expense: formatMinorUnits(expense) };
  }
}
