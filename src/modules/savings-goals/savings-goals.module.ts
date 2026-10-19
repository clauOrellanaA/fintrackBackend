import { Module } from '@nestjs/common';
import { SavingsReservationReader } from '../../shared/savings-reservation.reader';
import { PersistedSavingsReservationReader } from './persisted-savings-reservation.reader';
import { SavingsGoalsService } from './savings-goals.service';

@Module({ providers: [SavingsGoalsService, { provide: SavingsReservationReader, useClass: PersistedSavingsReservationReader }],
  exports: [SavingsGoalsService, SavingsReservationReader] })
export class SavingsGoalsModule {}
