import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PersistenceService } from '../../database/persistence.module';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { SavingsReservationReader } from './savings-reservation.reader';

interface BalanceRow { amount: string; currency: string; opening_at: Date }

@Injectable()
export class BalanceService {
  constructor(private readonly persistence: PersistenceService, private readonly reservations: SavingsReservationReader) {}

  async getForUser(userId: string, asOf: Date) {
    // One snapshot for opening/movements and the future reservation adapter.
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const rows: BalanceRow[] = await manager.query(`
        SELECT u.currency, u.opening_at,
          (u.opening_balance + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0))::text AS amount
        FROM users u LEFT JOIN transactions t ON t.user_id = u.id
          AND t.currency = u.currency AND t.status = 'posted'
          AND t.occurred_at >= u.opening_at AND t.occurred_at <= $2
        WHERE u.id = $1
        GROUP BY u.id, u.currency, u.opening_at, u.opening_balance
      `, [userId, asOf]);
      const row = rows[0];
      if (!row) throw new UnauthorizedException({ error: { code: 'UNAUTHENTICATED', message: 'Sesion requerida o invalida.' } });
      if (row.currency !== 'BOB' || row.opening_at > asOf) return integrityError();
      const reserved = await this.reservations.reservedMinorUnits(userId, asOf, manager);
      if (typeof reserved !== 'bigint' || reserved < 0n) return integrityError();
      return { amount: formatMinorUnits(decimalToMinorUnits(row.amount) - reserved), currency: row.currency, cutoff: asOf.toISOString() };
    });
  }
}
