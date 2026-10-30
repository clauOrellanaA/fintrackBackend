import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({ imports: [AuthModule, BudgetsModule, SavingsGoalsModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
