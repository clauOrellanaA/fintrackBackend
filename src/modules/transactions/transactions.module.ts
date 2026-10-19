import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { BalanceService } from './balance.service';
import { SavingsNotEnabled, SavingsReservationReader } from './savings-reservation.reader';

@Module({ providers: [TransactionsService, BalanceService, { provide: SavingsReservationReader, useClass: SavingsNotEnabled }], exports: [TransactionsService, BalanceService, SavingsReservationReader] })
export class TransactionsModule {}
