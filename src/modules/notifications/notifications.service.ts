import { Injectable } from '@nestjs/common';
import { PersistenceService } from '../../database/persistence.module';
import { BudgetsService } from '../budgets/budgets.service';
import { resolvePeriod } from '../dashboard/period';
import { SavingsGoalsService } from '../savings-goals/savings-goals.service';
import { projectNotifications } from './notification-projection';

@Injectable()
export class NotificationsService {
  constructor(private readonly budgets: BudgetsService, private readonly goals: SavingsGoalsService, private readonly persistence: PersistenceService) {}

  async getForUser(userId: string, query: Record<string, unknown>, asOf = new Date()) {
    const period = resolvePeriod(query, asOf);
    return this.persistence.source.transaction('REPEATABLE READ', async manager => {
      const budgets = await this.budgets.getForUser(userId, period, manager);
      const goals = await this.goals.getForUser(userId, asOf, manager);
      const items = projectNotifications(budgets, goals);
      return { asOf: asOf.toISOString(), period, currency: 'BOB' as const, items, total: items.length };
    });
  }
}
