import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export abstract class SavingsReservationReader {
  abstract reservedMinorUnits(userId: string, asOf: Date, manager: EntityManager): Promise<bigint>;
}

// BE-01 schema has neither savings persistence nor a write path for reservations.
// BE-06 MUST replace this provider before enabling either capability. Never use as
// fallback for a configured reader failure; its errors must abort the dashboard.
@Injectable()
export class SavingsNotEnabled extends SavingsReservationReader {
  async reservedMinorUnits(): Promise<bigint> { return 0n; }
}
