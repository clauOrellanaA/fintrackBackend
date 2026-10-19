import type { EntityManager } from 'typeorm';

export abstract class SavingsReservationReader {
  abstract reservedMinorUnits(userId: string, asOf: Date, manager: EntityManager): Promise<bigint>;
}
