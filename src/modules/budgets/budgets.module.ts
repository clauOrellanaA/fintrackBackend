import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsService } from './budgets.service';

@Module({ imports: [TransactionsModule], providers: [BudgetsService], exports: [BudgetsService] })
export class BudgetsModule {}
