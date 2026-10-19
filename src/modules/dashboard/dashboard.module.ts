import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({ imports: [AuthModule, UsersModule, TransactionsModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
