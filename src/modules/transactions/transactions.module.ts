import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { BalanceService } from './balance.service';
import { SavingsNotEnabled, SavingsReservationReader } from './savings-reservation.reader';
import { MonthlySummaryService } from './monthly-summary.service';
import { ExpenseDistributionService } from './expense-distribution.service';

@Module({ providers: [TransactionsService, BalanceService, MonthlySummaryService, ExpenseDistributionService, { provide: SavingsReservationReader, useClass: SavingsNotEnabled }], exports: [TransactionsService, BalanceService, MonthlySummaryService, ExpenseDistributionService, SavingsReservationReader] })
export class TransactionsModule {}
