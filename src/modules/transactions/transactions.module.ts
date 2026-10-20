import { Module } from '@nestjs/common';
import { TransactionsService, CategoriesService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CategoriesController } from './categories.controller';
import { BalanceService } from './balance.service';
import { AuthModule } from '../auth/auth.module';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';
import { MonthlySummaryService } from './monthly-summary.service';
import { ExpenseDistributionService } from './expense-distribution.service';

@Module({
  imports: [AuthModule, SavingsGoalsModule],
  controllers: [TransactionsController, CategoriesController],
  providers: [TransactionsService, CategoriesService, BalanceService, MonthlySummaryService, ExpenseDistributionService],
  exports: [TransactionsService, CategoriesService, BalanceService, MonthlySummaryService, ExpenseDistributionService, SavingsGoalsModule],
})
export class TransactionsModule {}
