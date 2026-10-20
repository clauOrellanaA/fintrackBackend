import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';

@Module({ imports: [AuthModule, TransactionsModule], controllers: [BudgetsController], providers: [BudgetsService], exports: [BudgetsService] })
export class BudgetsModule {}
