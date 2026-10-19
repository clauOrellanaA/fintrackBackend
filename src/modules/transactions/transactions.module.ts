import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { BalanceService } from './balance.service';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';
import { MonthlySummaryService } from './monthly-summary.service';
import { ExpenseDistributionService } from './expense-distribution.service';

@Module({ imports: [SavingsGoalsModule], providers: [TransactionsService, BalanceService, MonthlySummaryService, ExpenseDistributionService], exports: [TransactionsService, BalanceService, MonthlySummaryService, ExpenseDistributionService, SavingsGoalsModule] })
export class TransactionsModule {}
