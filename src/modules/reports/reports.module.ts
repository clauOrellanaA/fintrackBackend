import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AuthModule, TransactionsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
