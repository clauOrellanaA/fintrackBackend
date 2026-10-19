import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { SavingsReservationReader } from '../../shared/savings-reservation.reader';
import { decimalToMinorUnits, formatMinorUnits, integrityError } from '../../shared/money';
import { SAVINGS_DELTA } from './savings-scope';

@Injectable()
export class PersistedSavingsReservationReader extends SavingsReservationReader {
  async reservedMinorUnits(userId: string, asOf: Date, manager: EntityManager): Promise<bigint> {
    const [row]: { reserved: string }[] = await manager.query(`
      SELECT COALESCE(SUM(${SAVINGS_DELTA}), 0)::text AS reserved
      FROM savings_goals g JOIN savings_entries e ON e.goal_id = g.id AND e.user_id = g.user_id
      WHERE g.user_id = $1 AND g.currency = 'BOB' AND e.currency = g.currency
        AND g.created_at <= $2 AND e.occurred_at <= $2
    `, [userId, asOf]);
    const reserved = decimalToMinorUnits(row.reserved);
    if (reserved < 0n) return integrityError();
    formatMinorUnits(reserved);
    // Archival deliberately has no filter: hiding a goal never releases money.
    return reserved;
  }
}
