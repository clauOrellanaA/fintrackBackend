import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseService } from './database/database.service';
import { PersistenceModule } from './database/persistence.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './shared/filters/api-exception.filter';

@Module({ imports: [PersistenceModule, AuthModule, DashboardModule, TransactionsModule], controllers: [HealthController],
  providers: [DatabaseService, { provide: APP_FILTER, useClass: ApiExceptionFilter }] })
export class AppModule {}
