import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({ imports: [AuthModule, UsersModule, TransactionsModule, BudgetsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
