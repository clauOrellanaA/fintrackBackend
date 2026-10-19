import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { BalanceService } from './balance.service';
import { SavingsNotEnabled, SavingsReservationReader } from './savings-reservation.reader';
import { MonthlySummaryService } from './monthly-summary.service';

@Module({ providers: [TransactionsService, BalanceService, MonthlySummaryService, { provide: SavingsReservationReader, useClass: SavingsNotEnabled }], exports: [TransactionsService, BalanceService, MonthlySummaryService, SavingsReservationReader] })
export class TransactionsModule {}
