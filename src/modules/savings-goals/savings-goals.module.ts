import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SavingsReservationReader } from '../../shared/savings-reservation.reader';
import { PersistedSavingsReservationReader } from './persisted-savings-reservation.reader';
import { SavingsGoalsController } from './savings-goals.controller';
import { SavingsGoalsService } from './savings-goals.service';

@Module({ imports: [AuthModule], controllers: [SavingsGoalsController], providers: [SavingsGoalsService, { provide: SavingsReservationReader, useClass: PersistedSavingsReservationReader }],
  exports: [SavingsGoalsService, SavingsReservationReader] })
export class SavingsGoalsModule {}
